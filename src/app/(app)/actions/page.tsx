"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { ActionItem } from "@/lib/types";
import {
  buildFollowUpActions,
  buildTaskActions,
  buildStaleActions,
} from "@/lib/action-scoring";
import { addDays } from "date-fns";
import { Zap, Phone, Mail, Clock, CheckCircle2 } from "lucide-react";

const TIER_COLORS: Record<string, string> = {
  A: "bg-[#b31a35] text-white",
  B: "bg-[#003087] text-white",
  C: "bg-[#666666] text-white",
  P: "bg-[#222228] text-[#a1a1aa]",
};

export default function ActionsPage() {
  const [actions, setActions] = useState<ActionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const supabase = createClient();

  const fetchActions = useCallback(async () => {
    setLoading(true);

    const {
      data: { user },
    } = await supabase.auth.getUser();
    const uid = user?.id ?? null;
    setUserId(uid);

    const horizon = addDays(new Date(), 7).toISOString().split("T")[0];

    const [followUpsRes, tasksRes, contactsRes, interactionsRes] =
      await Promise.all([
        supabase
          .from("follow_ups")
          .select(
            "*, contacts(id, first_name, last_name, tier, health_score, company, phone, email)"
          )
          .eq("status", "pending")
          .lte("due_date", horizon)
          .order("due_date"),
        supabase
          .from("tasks")
          .select(
            "*, contacts(id, first_name, last_name, tier, health_score, company, phone, email)"
          )
          .in("status", ["pending", "in_progress"])
          .not("contact_id", "is", null)
          .not("due_date", "is", null)
          .lte("due_date", horizon)
          .order("due_date"),
        supabase
          .from("contacts")
          .select("*")
          .not("tier", "is", null)
          .is("deleted_at", null)
          .in("relationship", ["warm", "active_partner", "advocate"]),
        supabase
          .from("interactions")
          .select("contact_id, occurred_at")
          .order("occurred_at", { ascending: false }),
      ]);

    const followUpItems = buildFollowUpActions(followUpsRes.data ?? []);
    const taskItems = buildTaskActions(tasksRes.data ?? []);

    // Build last-interaction lookup: contactId -> most recent date
    const lastInteractions: Record<string, string> = {};
    for (const row of interactionsRes.data ?? []) {
      if (!lastInteractions[row.contact_id]) {
        lastInteractions[row.contact_id] = row.occurred_at;
      }
    }

    const staleItems = buildStaleActions(
      contactsRes.data ?? [],
      lastInteractions
    );

    const merged = [...followUpItems, ...taskItems, ...staleItems].sort(
      (a, b) => b.priority - a.priority
    );

    setActions(merged);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchActions();
  }, [fetchActions]);

  async function handleComplete(
    item: ActionItem,
    interactionType: "call" | "email"
  ) {
    if (!userId) return;

    // Log interaction
    await supabase.from("interactions").insert({
      user_id: userId,
      contact_id: item.contactId,
      type: interactionType,
      summary: `Follow-up: ${item.title}`,
      direction: "outbound",
    });

    // Complete source record
    if (item.sourceTable === "follow_ups") {
      await supabase
        .from("follow_ups")
        .update({
          status: "completed",
          completed_at: new Date().toISOString(),
        })
        .eq("id", item.sourceId);
    } else if (item.sourceTable === "tasks") {
      await supabase
        .from("tasks")
        .update({
          status: "completed",
          completed_at: new Date().toISOString(),
        })
        .eq("id", item.sourceId);
    }

    // Bump health score
    await supabase
      .from("contacts")
      .update({
        health_score: Math.min(item.contactHealthScore + 5, 100),
      })
      .eq("id", item.contactId);

    await fetchActions();
  }

  async function handleSkip(item: ActionItem) {
    if (!userId) return;

    const tomorrow = addDays(new Date(), 1).toISOString().split("T")[0];

    if (item.sourceTable === "follow_ups") {
      await supabase
        .from("follow_ups")
        .update({ due_date: tomorrow })
        .eq("id", item.sourceId);
    } else if (item.sourceTable === "tasks") {
      await supabase
        .from("tasks")
        .update({ due_date: tomorrow })
        .eq("id", item.sourceId);
    } else if (item.sourceTable === "contacts") {
      // Create a new follow-up for stale contacts
      await supabase.from("follow_ups").insert({
        user_id: userId,
        contact_id: item.contactId,
        reason: "Reconnect -- stale contact",
        due_date: tomorrow,
        status: "pending",
      });
    }

    await fetchActions();
  }

  if (loading) {
    return (
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-muted-foreground" />
            <h1 className="text-xl font-semibold text-foreground font-display">Actions</h1>
          </div>
        </div>
        <p className="text-sm text-muted-foreground py-8 text-center">Loading...</p>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <Zap className="h-5 w-5 text-[#b31a35]" />
          <h1 className="text-xl font-semibold text-foreground font-display">Actions</h1>
        </div>
        <span className="text-sm text-muted-foreground">
          {actions.length} remaining
        </span>
      </div>

      {actions.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
          <CheckCircle2 className="h-10 w-10 mb-3" />
          <p className="text-sm">Nothing to do right now. Nice work.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {actions.map((item) => (
            <div
              key={item.id}
              className="bg-card rounded-xl border border-border p-4 shadow-sm"
            >
              <div className="flex items-start gap-3">
                {/* Tier badge */}
                <div
                  className={`flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold ${
                    item.contactTier
                      ? TIER_COLORS[item.contactTier]
                      : "bg-[#222228] text-[#a1a1aa]"
                  }`}
                >
                  {item.contactTier ?? "-"}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline gap-2">
                    <span className="text-sm font-semibold text-foreground truncate">
                      {item.contactName}
                    </span>
                    {item.contactCompany && (
                      <span className="text-xs text-[#666666] truncate">
                        {item.contactCompany}
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground mt-0.5">{item.title}</p>
                  <p className="text-xs text-[#999999] mt-0.5">
                    {item.subtitle}
                  </p>
                </div>

                {/* Action buttons */}
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  <button
                    onClick={() => handleComplete(item, "call")}
                    className="w-8 h-8 rounded-full flex items-center justify-center text-muted-foreground hover:text-green-600 hover:bg-green-900/20 transition-colors"
                    title="Log call"
                  >
                    <Phone className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => handleComplete(item, "email")}
                    className="w-8 h-8 rounded-full flex items-center justify-center text-muted-foreground hover:text-blue-400 hover:bg-blue-900/20 transition-colors"
                    title="Log email"
                  >
                    <Mail className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => handleSkip(item)}
                    className="w-8 h-8 rounded-full flex items-center justify-center text-muted-foreground hover:text-amber-400 hover:bg-amber-900/20 transition-colors"
                    title="Skip to tomorrow"
                  >
                    <Clock className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
