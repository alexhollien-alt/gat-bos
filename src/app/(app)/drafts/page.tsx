// Phase 1.3.1 Phase 5 -- /drafts approval dashboard.
// Server shell prefetches drafts list, hands off to client for live updates.
import {
  QueryClient,
  dehydrate,
  HydrationBoundary,
} from "@tanstack/react-query";
import { headers } from "next/headers";
import { createClient as createServerSupabase } from "@/lib/supabase/server";
import { DraftsClient, type DraftRow } from "./drafts-client";
import { redirect } from "next/navigation";
import { ALEX_EMAIL } from "@/lib/constants";

export const dynamic = "force-dynamic";

async function fetchDraftsServer(): Promise<DraftRow[]> {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const proto = h.get("x-forwarded-proto") ?? "http";
  const cookie = h.get("cookie") ?? "";
  if (!host) return [];
  const res = await fetch(`${proto}://${host}/api/email/drafts`, {
    cache: "no-store",
    headers: { cookie },
  });
  if (!res.ok) return [];
  const json = (await res.json()) as { drafts?: DraftRow[] };
  return json.drafts ?? [];
}

export default async function DraftsPage() {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login?next=/drafts");
  if (user.email?.toLowerCase() !== ALEX_EMAIL) redirect("/");

  const queryClient = new QueryClient();
  await queryClient.prefetchQuery({
    queryKey: ["email_drafts", "pending"],
    queryFn: fetchDraftsServer,
  });

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <DraftsClient />
    </HydrationBoundary>
  );
}
