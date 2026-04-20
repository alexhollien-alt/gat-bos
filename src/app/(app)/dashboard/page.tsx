/**
 * Dashboard -- Server Component shell
 *
 * Per ~/.claude/rules/dashboard.md Section 6:
 *   - Server Components: layout shells, initial data prefetch via
 *     prefetchQuery + HydrationBoundary. Zero client JavaScript.
 *   - Client Components: TanStack Query hooks, Supabase Realtime,
 *     optimistic mutations.
 *
 * This page prefetches the four dashboard queries (hot contacts, all
 * contacts, opportunities, recent interactions) using the cookie-bound
 * SSR supabase client so they honor the logged-in user's RLS, then hands
 * the dehydrated cache to DashboardClient which consumes via useQuery with
 * identical keys. First paint ships with real data rather than empty state.
 *
 * Refs: 2026-04-12-crm-bug-hunt.md (P1-5)
 */

import {
  QueryClient,
  dehydrate,
  HydrationBoundary,
} from "@tanstack/react-query";
import { startOfMonth } from "date-fns";
import { createClient } from "@/lib/supabase/server";
import { DashboardClient } from "./dashboard-client";

const COLD_THRESHOLD_DAYS = 21;

export default async function DashboardPage() {
  const queryClient = new QueryClient();
  const supabase = await createClient();

  await Promise.all([
    queryClient.prefetchQuery({
      queryKey: ["dashboard", "hot_contacts"],
      queryFn: async () => {
        const { data } = await supabase
          .from("contacts")
          .select("*")
          .is("deleted_at", null)
          .gt("health_score", 0)
          .order("health_score", { ascending: false })
          .limit(8);
        return data ?? [];
      },
    }),
    queryClient.prefetchQuery({
      queryKey: ["dashboard", "all_contacts"],
      queryFn: async () => {
        const { data } = await supabase
          .from("contacts")
          .select("*")
          .is("deleted_at", null)
          .order("first_name", { ascending: true });
        return data ?? [];
      },
    }),
    queryClient.prefetchQuery({
      queryKey: ["dashboard", "opportunities"],
      queryFn: async () => {
        const { data } = await supabase
          .from("opportunities")
          .select("*, contacts(id, first_name, last_name)")
          .is("deleted_at", null)
          .order("created_at", { ascending: false });
        return data ?? [];
      },
    }),
    queryClient.prefetchQuery({
      queryKey: ["dashboard", "recent_interactions"],
      queryFn: async () => {
        const { data } = await supabase
          .from("interactions")
          .select("*, contacts(id, first_name, last_name)")
          .order("occurred_at", { ascending: false })
          .limit(8);
        return data ?? [];
      },
    }),
    queryClient.prefetchQuery({
      queryKey: ["dashboard", "tile_files_in_flight"],
      queryFn: async () => {
        const { count } = await supabase
          .from("opportunities")
          .select("id", { count: "exact", head: true })
          .is("deleted_at", null)
          .in("stage", ["under_contract", "in_escrow"]);
        return count ?? 0;
      },
    }),
    queryClient.prefetchQuery({
      queryKey: ["dashboard", "tile_files_closed_month"],
      queryFn: async () => {
        const monthStart = startOfMonth(new Date()).toISOString();
        const { count } = await supabase
          .from("opportunities")
          .select("id", { count: "exact", head: true })
          .is("deleted_at", null)
          .eq("stage", "closed")
          .gte("closed_at", monthStart);
        return count ?? 0;
      },
    }),
    queryClient.prefetchQuery({
      queryKey: ["dashboard", "tile_new_listings_7d"],
      queryFn: async () => {
        const sevenDaysAgo = new Date(
          Date.now() - 7 * 24 * 60 * 60 * 1000,
        ).toISOString();
        const { data } = await supabase
          .from("opportunities")
          .select("id, contacts!inner(tier)")
          .is("deleted_at", null)
          .gte("created_at", sevenDaysAgo)
          .in("contacts.tier", ["A", "B"]);
        return (data ?? []).length;
      },
    }),
    queryClient.prefetchQuery({
      queryKey: ["dashboard", "tile_cold_agents_21d"],
      queryFn: async () => {
        const cutoff = new Date(
          Date.now() - COLD_THRESHOLD_DAYS * 24 * 60 * 60 * 1000,
        ).toISOString();
        const { count } = await supabase
          .from("contacts")
          .select("id", { count: "exact", head: true })
          .is("deleted_at", null)
          .eq("tier", "A")
          .or(`last_touchpoint.is.null,last_touchpoint.lt.${cutoff}`);
        return count ?? 0;
      },
    }),
  ]);

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <DashboardClient />
    </HydrationBoundary>
  );
}
