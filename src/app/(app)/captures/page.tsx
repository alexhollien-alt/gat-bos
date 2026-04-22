import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import type { Capture } from "@/lib/types";
import { CapturesClient } from "./captures-client";

export const dynamic = "force-dynamic";

export default async function CapturesPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/captures");

  const { data, error } = await supabase
    .from("captures")
    .select(
      "id, user_id, raw_text, parsed_intent, parsed_contact_id, parsed_payload, processed, created_at, updated_at, contacts:parsed_contact_id(id, first_name, last_name)"
    )
    .order("created_at", { ascending: false })
    .limit(200);

  const captures = (data ?? []) as unknown as Capture[];

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <header className="space-y-1">
        <h1
          className="text-2xl font-semibold tracking-tight"
          style={{ fontFamily: "var(--font-display)" }}
        >
          Captures
        </h1>
        <p className="text-sm text-muted-foreground">
          Drop a thought in the bar at the bottom of any page. Parsed intent and
          matched contacts show up here.
        </p>
      </header>

      {error ? (
        <div className="rounded-md border border-border bg-secondary/40 p-4 text-sm text-muted-foreground">
          Couldn&apos;t load captures: {error.message}
        </div>
      ) : (
        <CapturesClient initial={captures} />
      )}
    </div>
  );
}
