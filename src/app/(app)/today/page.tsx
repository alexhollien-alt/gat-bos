/**
 * Today View -- Server Component shell
 *
 * Prefetches the spine TodayPayload via fetchTodayPayload, then hands
 * the dehydrated TanStack Query cache to TodayClient for hydration.
 * Same pattern as /dashboard (see dashboard.md Section 6).
 */

import {
  QueryClient,
  dehydrate,
  HydrationBoundary,
} from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/server";
import { fetchTodayPayload } from "@/lib/spine/queries";
import { TodayClient } from "./today-client";

export default async function TodayPage() {
  const queryClient = new QueryClient();
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    await queryClient.prefetchQuery({
      queryKey: ["spine", "today"],
      queryFn: () => fetchTodayPayload(supabase, user.id),
    });
  }

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <TodayClient />
    </HydrationBoundary>
  );
}
