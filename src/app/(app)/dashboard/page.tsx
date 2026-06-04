/**
 * Dashboard -- Server Component shell for the 3-tab dashboard.
 *
 * Prefetches the always-visible surfaces (recency-scored contacts, open tasks,
 * today's counters) with the cookie-bound SSR client so first paint ships with
 * real data under the logged-in user's RLS. The Agents roster (prospects) and
 * Activity weekly stats are left client-only and load lazily when their tab is
 * opened. Keys here must match the client hooks in queries.ts (KEY.*).
 */

import {
  QueryClient,
  dehydrate,
  HydrationBoundary,
} from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/server";
import { getScoredContacts } from "./actions";
import { fetchCounters, fetchOpenTasks } from "./_data";
import { DashboardClient } from "./dashboard-client";

export default async function DashboardPage() {
  const queryClient = new QueryClient();
  const supabase = await createClient();

  await Promise.all([
    queryClient.prefetchQuery({
      queryKey: ["dashboard", "v3", "scored"],
      queryFn: () => getScoredContacts(),
    }),
    queryClient.prefetchQuery({
      queryKey: ["dashboard", "v3", "tasks", "open"],
      queryFn: () => fetchOpenTasks(supabase),
    }),
    queryClient.prefetchQuery({
      queryKey: ["dashboard", "v3", "counters"],
      queryFn: () => fetchCounters(supabase),
    }),
  ]);

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <DashboardClient />
    </HydrationBoundary>
  );
}
