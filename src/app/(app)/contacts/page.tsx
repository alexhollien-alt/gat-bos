"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { ContactWithTags } from "@/lib/types";
import { ContactCard } from "@/components/contacts/contact-card";
import { ContactFilters } from "@/components/contacts/contact-filters";
import { ContactFormModal } from "@/components/contacts/contact-form-modal";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";

export default function ContactsPage() {
  const [contacts, setContacts] = useState<ContactWithTags[]>([]);
  const [search, setSearch] = useState("");
  const [relationship, setRelationship] = useState("all");
  const [tagId, setTagId] = useState("all");
  const [showForm, setShowForm] = useState(false);
  const supabase = createClient();

  const fetchContacts = useCallback(async () => {
    const { data } = await supabase
      .from("contacts")
      .select("*, contact_tags(tags(*))")
      .order("last_name");
    if (data) setContacts(data as ContactWithTags[]);
  }, []);

  useEffect(() => {
    fetchContacts();
  }, [fetchContacts]);

  const filtered = useMemo(() => {
    return contacts.filter((c) => {
      const searchLower = search.toLowerCase();
      const matchesSearch =
        !search ||
        `${c.first_name} ${c.last_name}`.toLowerCase().includes(searchLower) ||
        c.company?.toLowerCase().includes(searchLower) ||
        c.email?.toLowerCase().includes(searchLower);

      const matchesRelationship =
        relationship === "all" || c.relationship === relationship;

      const matchesTag =
        tagId === "all" ||
        c.contact_tags.some((ct) => ct.tags.id === tagId);

      return matchesSearch && matchesRelationship && matchesTag;
    });
  }, [contacts, search, relationship, tagId]);

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
        tagId={tagId}
        onTagChange={setTagId}
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
              tags={contact.contact_tags.map((ct) => ct.tags)}
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
