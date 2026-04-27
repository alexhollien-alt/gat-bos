import { createClient } from "@/lib/supabase/server";
import { CaptureBar } from "@/components/capture-bar";
import type { ContactIndexEntry } from "@/lib/captures/rules";

export async function CaptureBarServer() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: contacts } = await supabase
    .from("contacts")
    .select("id, first_name, last_name")
    .is("deleted_at", null);

  const contactsIndex: ContactIndexEntry[] = (contacts ?? []).map((c) => ({
    id: c.id,
    first_name: c.first_name ?? "",
    last_name: c.last_name ?? "",
  }));

  return <CaptureBar contactsIndex={contactsIndex} />;
}
