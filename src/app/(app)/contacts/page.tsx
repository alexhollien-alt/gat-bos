"use client";

import { useEffect, useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { Contact, ContactTier } from "@/lib/types";
import { ContactCard } from "@/components/contacts/contact-card";
import {
  ContactFilters,
  ContactSortKey,
} from "@/components/contacts/contact-filters";
import { ContactFormModal } from "@/components/contacts/contact-form-modal";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { AccentRule, PageHeader, SectionShell } from "@/components/screen";

// Section order. "untiered" is a synthetic bucket for contacts with tier = null.
const TIER_ORDER = ["A", "B", "C", "P", "untiered"] as const;
type TierKey = (typeof TIER_ORDER)[number];

const TIER_LABELS: Record<TierKey, string> = {
  A: "Tier A",
  B: "Tier B",
  C: "Tier C",
  P: "Tier P",
  untiered: "Untiered",
};

const PAGE_SIZE = 25;

function getTierKey(tier: ContactTier | null): TierKey {
  return tier ?? "untiered";
}

function sortContacts(
  rows: Contact[],
  sortBy: ContactSortKey,
): Contact[] {
  const copy = [...rows];
  switch (sortBy) {
    case "lastname_asc":
      return copy.sort((a, b) =>
        (a.last_name || "").localeCompare(b.last_name || ""),
      );
    case "lastname_desc":
      return copy.sort((a, b) =>
        (b.last_name || "").localeCompare(a.last_name || ""),
      );
    case "recent_added":
      return copy.sort(
        (a, b) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
      );
    case "recent_touched":
      return copy.sort((a, b) => {
        const aTime = a.last_touchpoint
          ? new Date(a.last_touchpoint).getTime()
          : 0;
        const bTime = b.last_touchpoint
          ? new Date(b.last_touchpoint).getTime()
          : 0;
        return bTime - aTime;
      });
  }
}

export default function ContactsPage() {
  const [search, setSearch] = useState("");
  const [relationship, setRelationship] = useState("all");
  const [sortBy, setSortBy] = useState<ContactSortKey>("lastname_asc");
  const [tierLimits, setTierLimits] = useState<Record<TierKey, number>>({
    A: PAGE_SIZE,
    B: PAGE_SIZE,
    C: PAGE_SIZE,
    P: PAGE_SIZE,
    untiered: PAGE_SIZE,
  });
  const [showForm, setShowForm] = useState(false);
  const supabase = createClient();
  const queryClient = useQueryClient();

  // ----------------------------------------------------------
  // Data: TanStack Query for contacts + touch counts
  // ----------------------------------------------------------
  const { data: contacts = [] } = useQuery({
    queryKey: ["contacts"],
    queryFn: async () => {
      // Tags subsystem (contact_tags + tags tables) is not present in
      // the live DB. Tag rebuild is its own future phase.
      const { data, error } = await supabase
        .from("contacts")
        .select("*")
        .is("deleted_at", null)
        .order("last_name");
      if (error) throw error;
      return (data ?? []) as Contact[];
    },
    staleTime: 5 * 60 * 1000, // 5 min -- agent profiles rarely change
  });

  const { data: touchCounts = {} } = useQuery({
    queryKey: ["contacts", "touch_counts"],
    queryFn: async () => {
      const thirtyDaysAgo = new Date(
        Date.now() - 30 * 24 * 60 * 60 * 1000,
      ).toISOString();
      const { data, error } = await supabase
        .from("interactions")
        .select("contact_id")
        .gte("occurred_at", thirtyDaysAgo);
      if (error) throw error;
      const counts: Record<string, number> = {};
      for (const row of data as { contact_id: string }[]) {
        counts[row.contact_id] = (counts[row.contact_id] || 0) + 1;
      }
      return counts;
    },
    staleTime: 30 * 1000, // 30s -- touch counts change more often
  });

  // ----------------------------------------------------------
  // Realtime: invalidate queries on contacts or interactions change
  // ----------------------------------------------------------
  useEffect(() => {
    const channels = [
      supabase
        .channel("contacts:all")
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "contacts" },
          () => {
            queryClient.invalidateQueries({ queryKey: ["contacts"] });
          }
        )
        .subscribe(),
      supabase
        .channel("contacts:interactions")
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "interactions" },
          () => {
            queryClient.invalidateQueries({
              queryKey: ["contacts", "touch_counts"],
            });
          }
        )
        .subscribe(),
    ];

    return () => {
      channels.forEach((c) => supabase.removeChannel(c));
    };
  }, [queryClient, supabase]);

  // Apply search + relationship filter first, then group by tier, then sort
  // within each group. Per-section "Show more" slicing happens at render.
  const grouped = useMemo(() => {
    const searchLower = search.toLowerCase();
    const filtered = contacts.filter((c) => {
      const matchesSearch =
        !search ||
        `${c.first_name} ${c.last_name}`.toLowerCase().includes(searchLower) ||
        c.brokerage?.toLowerCase().includes(searchLower) ||
        c.email?.toLowerCase().includes(searchLower);

      const matchesRelationship =
        relationship === "all" || c.stage === relationship;

      return matchesSearch && matchesRelationship;
    });

    const buckets: Record<TierKey, Contact[]> = {
      A: [],
      B: [],
      C: [],
      P: [],
      untiered: [],
    };

    for (const c of filtered) {
      buckets[getTierKey(c.tier)].push(c);
    }

    for (const key of TIER_ORDER) {
      buckets[key] = sortContacts(buckets[key], sortBy);
    }

    return buckets;
  }, [contacts, search, relationship, sortBy]);

  const totalMatched = useMemo(
    () => TIER_ORDER.reduce((sum, k) => sum + grouped[k].length, 0),
    [grouped],
  );

  const handleShowMore = (key: TierKey) => {
    setTierLimits((prev) => ({ ...prev, [key]: prev[key] + PAGE_SIZE }));
  };

  // Reset pagination when filters change so a search doesn't leave you deep
  // in a stale "show more" state.
  useEffect(() => {
    setTierLimits({
      A: PAGE_SIZE,
      B: PAGE_SIZE,
      C: PAGE_SIZE,
      P: PAGE_SIZE,
      untiered: PAGE_SIZE,
    });
  }, [search, relationship, sortBy]);

  const renderSection = (key: TierKey) => {
    const rows = grouped[key];
    if (rows.length === 0) return null;

    const limit = tierLimits[key];
    const visible = rows.slice(0, limit);
    const hiddenCount = rows.length - visible.length;

    return (
      <section key={key} className="flex flex-col">
        <div className="flex items-baseline justify-between pb-2 mb-2 px-1">
          <h2 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground font-display">
            {TIER_LABELS[key]}
          </h2>
          <span className="font-mono text-[10px] text-muted-foreground tabular-nums">
            {visible.length} / {rows.length}
          </span>
        </div>
        <div className="rounded-lg border border-border divide-y divide-border overflow-hidden bg-card">
          {visible.map((contact) => (
            <ContactCard
              key={contact.id}
              contact={contact}
              touchCount={touchCounts[contact.id] || 0}
            />
          ))}
        </div>
        {hiddenCount > 0 && (
          <div className="mt-3 flex justify-center">
            <Button
              size="sm"
              variant="ghost"
              onClick={() => handleShowMore(key)}
            >
              Show {Math.min(PAGE_SIZE, hiddenCount)} more
            </Button>
          </div>
        )}
      </section>
    );
  };

  const tieredKeys: TierKey[] = ["A", "B", "C", "P"];
  const hasUntiered = grouped.untiered.length > 0;

  return (
    <SectionShell maxWidth="full" padY="none" className="px-0 sm:px-0 max-w-7xl mx-0">
      <PageHeader
        eyebrow="Relationships"
        title="Contacts"
        right={
          <Button onClick={() => setShowForm(true)} size="sm">
            <Plus className="h-4 w-4 mr-1" />
            Add contact
          </Button>
        }
      />
      <AccentRule variant="hairline" className="mt-6 mb-6" />

      <ContactFilters
        search={search}
        onSearchChange={setSearch}
        relationship={relationship}
        onRelationshipChange={setRelationship}
        sortBy={sortBy}
        onSortChange={setSortBy}
      />

      {totalMatched === 0 ? (
        <p className="text-sm text-slate-400 py-8 text-center">
          No contacts found
        </p>
      ) : (
        <div className="mt-6 space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 items-start">
            {tieredKeys.map((key) => renderSection(key))}
          </div>
          {hasUntiered && renderSection("untiered")}
        </div>
      )}

      <ContactFormModal
        open={showForm}
        onOpenChange={setShowForm}
        onSuccess={() =>
          queryClient.invalidateQueries({ queryKey: ["contacts"] })
        }
      />
    </SectionShell>
  );
}
