"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { ActionItem } from "@/lib/types";
import {
  buildFollowUpActions,
  buildTaskActions,
  buildStaleActions,
} from "@/lib/action-scoring";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { addDays } from "date-fns";
import { Zap, Phone, Mail, Clock, CheckCircle2 } from "lucide-react";

const DISPLAY_LIMIT = 8;

const TIER_CLASSES: Record<string, string> = {
  A: "bg-[#b31a35] text-white",
  B: "bg-[#003087] text-white",
  C: "bg-[#666666] text-white",
  P: "bg-[#222228] text-[#a1a1aa]",
};

export function ActionQueueWidget() {
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
            "*, contacts(id, first_name, last_name, tier, temperature, company, phone, email)"
          )
          .eq("status", "pending")
          .lte("due_date", horizon)
          .order("due_date"),
        supabase
          .from("tasks")
          .select(
            "*, contacts(id, first_name, last_name, tier, temperature, company, phone, email)"
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
  }, [supabase]);

  useEffect(() => {
    fetchActions();
  }, [fetchActions]);

  async function handleComplete(
    item: ActionItem,
    interactionType: "call" | "email"
  ) {
    if (!userId) return;

    await supabase.from("interactions").insert({
      user_id: userId,
      contact_id: item.contactId,
      type: interactionType,
      summary: `Follow-up: ${item.title}`,
      direction: "outbound",
    });

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

    await supabase
      .from("contacts")
      .update({
        temperature: Math.min(item.contactTemperature + 5, 100),
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

  const visible = actions.slice(0, DISPLAY_LIMIT);
  const totalCount = actions.length;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium text-muted-foreground flex items-center justify-between gap-2">
          <span className="flex items-center gap-2">
            <Zap className="h-4 w-4 text-[#b31a35]" />
            What&apos;s Next
          </span>
          {!loading && totalCount > 0 && (
            <span className="font-mono text-xs text-muted-foreground">
              {Math.min(DISPLAY_LIMIT, totalCount)} of {totalCount}
            </span>
          )}
        </CardTitle>
      </CardHeader>

      <CardContent className="pt-0">
        {loading ? (
          <div className="space-y-2 py-1">
            {[...Array(4)].map((_, i) => (
              <div
                key={i}
                className="h-10 rounded-md bg-secondary animate-pulse"
              />
            ))}
          </div>
        ) : visible.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-muted-foreground gap-2">
            <CheckCircle2 className="h-8 w-8" />
            <p className="text-sm">Nothing on the rotation. Nice work.</p>
          </div>
        ) : (
          <>
            <div className="space-y-1">
              {visible.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center gap-2 px-1 py-1.5 rounded-md hover:bg-secondary/50 transition-colors group"
                >
                  {/* Tier badge */}
                  <div
                    className={`flex-shrink-0 w-6 h-6 rounded flex items-center justify-center text-[10px] font-bold ${
                      item.contactTier
                        ? TIER_CLASSES[item.contactTier]
                        : "bg-[#222228] text-[#a1a1aa]"
                    }`}
                  >
                    {item.contactTier ?? "-"}
                  </div>

                  {/* Contact + action text */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate leading-tight">
                      {item.contactName}
                    </p>
                    <p className="text-xs text-muted-foreground truncate leading-tight">
                      {item.title}
                    </p>
                  </div>

                  {/* Quick-action buttons -- visible on row hover */}
                  <div className="flex items-center gap-0.5 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => handleComplete(item, "call")}
                      className="w-6 h-6 rounded flex items-center justify-center text-muted-foreground hover:text-green-500 hover:bg-green-900/20 transition-colors"
                      title="Log call + complete"
                    >
                      <Phone className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => handleComplete(item, "email")}
                      className="w-6 h-6 rounded flex items-center justify-center text-muted-foreground hover:text-blue-400 hover:bg-blue-900/20 transition-colors"
                      title="Log email + complete"
                    >
                      <Mail className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => handleSkip(item)}
                      className="w-6 h-6 rounded flex items-center justify-center text-muted-foreground hover:text-amber-400 hover:bg-amber-900/20 transition-colors"
                      title="Skip to tomorrow"
                    >
                      <Clock className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {totalCount > 0 && (
              <div className="mt-3 pt-2 border-t border-border">
                <Link
                  href="/actions"
                  className="text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"
                >
                  View all{" "}
                  <span className="font-mono">{totalCount}</span> actions
                  {" "}
                  &rarr;
                </Link>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
