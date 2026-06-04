import { createClient } from "@/lib/supabase/server";
import { NewBlastForm, type AgentOption } from "./NewBlastForm";

export const metadata = { title: "New Open House Blast" };

export default async function NewOpenHouseBlastPage() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("contacts")
    .select("id, first_name, last_name, full_name, brokerage")
    .in("type", ["realtor", "agent"])
    .is("deleted_at", null)
    .order("first_name", { ascending: true })
    .limit(500);

  const agents: AgentOption[] = (data ?? []).map((c) => ({
    id: c.id as string,
    name:
      (c.full_name as string | null)?.trim() ||
      `${c.first_name ?? ""} ${c.last_name ?? ""}`.trim() ||
      "(no name)",
    brokerage: (c.brokerage as string | null) ?? null,
  }));

  return (
    <div className="mx-auto max-w-2xl px-6 py-10">
      <h1 className="font-display text-2xl text-foreground">New open house blast</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Fill this in under two minutes. The system matches every agent in your pool tagged
        with the listing city, then shows a preview and recipient count before anything sends.
      </p>
      <NewBlastForm agents={agents} />
    </div>
  );
}
