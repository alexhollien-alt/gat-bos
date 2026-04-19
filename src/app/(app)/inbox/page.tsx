// src/app/(app)/inbox/page.tsx
import { HydrationBoundary, QueryClient, dehydrate } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/server";
import { InboxClient } from "./inbox-client";

export const metadata = { title: "Inbox | GAT-BOS" };

export default async function InboxPage() {
  const queryClient = new QueryClient();
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (user) {
    await queryClient.prefetchQuery({
      queryKey: ["inbox", "items", "pending"],
      queryFn: async () => {
        const { data } = await supabase
          .from("inbox_items")
          .select("*")
          .eq("user_id", user.id)
          .eq("status", "pending")
          .order("score", { ascending: false })
          .order("received_at", { ascending: false })
          .limit(50);
        return data ?? [];
      },
    });
  }

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <InboxClient />
    </HydrationBoundary>
  );
}
