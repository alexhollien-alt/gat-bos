"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { Contact } from "@/lib/types";
import { ContactCard } from "@/components/contacts/contact-card";
import { ContactFilters } from "@/components/contacts/contact-filters";
import { ContactFormModal } from "@/components/contacts/contact-form-modal";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";

export default function ContactsPage() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [search, setSearch] = useState("");
  const [relationship, setRelationship] = useState("all");
  const [showForm, setShowForm] = useState(false);
  const supabase = createClient();

  const fetchContacts = useCallback(async () => {
    // Tags subsystem (contact_tags + tags tables) is not present in
    // the live DB. The previous query joined contact_tags(tags(*)) and
    // PostgREST returned an error for the missing relation, breaking
    // the entire page. Tag rebuild is its own future phase.
    const { data } = await supabase
      .from("contacts")
      .select("*")
      .order("last_name");
    if (data) setContacts(data as Contact[]);
  }, [supabase]);

  useEffect(() => {
    fetchContacts();
  }, [fetchContacts]);

  const filtered = useMemo(() => {
    return contacts.filter((c) => {
      const searchLower = search.toLowerCase();
      const matchesSearch =
        !search ||
        `${c.first_name} ${c.last_name}`.toLowerCase().includes(searchLower) ||
        c.brokerage?.toLowerCase().includes(searchLower) ||
        c.email?.toLowerCase().includes(searchLower);

      const matchesRelationship =
        relationship === "all" || c.stage === relationship;

      return matchesSearch && matchesRelationship;
    });
  }, [contacts, search, relationship]);

  return (
    <div className="max-w-5xl">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-semibold text-foreground font-display">Contacts</h1>
        <Button onClick={() => setShowForm(true)} size="sm">
          <Plus className="h-4 w-4 mr-1" />
          Add contact
        </Button>
      </div>

      <ContactFilters
        search={search}
        onSearchChange={setSearch}
        relationship={relationship}
        onRelationshipChange={setRelationship}
      />

      <div className="grid gap-3 mt-4">
        {filtered.length === 0 ? (
          <p className="text-sm text-slate-400 py-8 text-center">
            No contacts found
          </p>
        ) : (
          filtered.map((contact) => (
            <ContactCard
              key={contact.id}
              contact={contact}
              tags={[]}
            />
          ))
        )}
      </div>

      <ContactFormModal
        open={showForm}
        onOpenChange={setShowForm}
        onSuccess={fetchContacts}
      />
    </div>
  );
}
