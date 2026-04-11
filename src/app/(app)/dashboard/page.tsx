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
import { createClient } from "@/lib/supabase/server";
import { DashboardClient } from "./dashboard-client";

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
  ]);

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <DashboardClient />
    </HydrationBoundary>
  );
}
