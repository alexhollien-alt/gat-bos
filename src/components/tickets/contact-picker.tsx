"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, X } from "lucide-react";

type ContactRow = {
  id: string;
  first_name: string;
  last_name: string;
  company: string | null;
  email: string | null;
  phone: string | null;
};

type Props = {
  value: string | null;
  onChange: (contact: ContactRow | null) => void;
  className?: string;
};

export function ContactPicker({ value, onChange, className }: Props) {
  const [contacts, setContacts] = useState<ContactRow[]>([]);
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<ContactRow | null>(null);
  const supabase = useMemo(() => createClient(), []);

  const fetchContacts = useCallback(async () => {
    const { data } = await supabase
      .from("contacts")
      .select("id, first_name, last_name, company, email, phone")
      .is("deleted_at", null)
      .order("last_name");
    if (data) setContacts(data as ContactRow[]);
  }, [supabase]);

  // Hydrate selected contact when value prop is provided
  useEffect(() => {
    if (value && contacts.length > 0) {
      const found = contacts.find((c) => c.id === value) ?? null;
      setSelected(found);
    } else if (!value) {
      setSelected(null);
    }
  }, [value, contacts]);

  useEffect(() => {
    fetchContacts();
  }, [fetchContacts]);

  const filtered = useMemo(
    () =>
      contacts.filter((c) => {
        const name = `${c.first_name} ${c.last_name} ${c.company ?? ""}`.toLowerCase();
        return name.includes(search.toLowerCase());
      }),
    [contacts, search],
  );

  function handleSelect(contact: ContactRow) {
    setSelected(contact);
    onChange(contact);
    setOpen(false);
    setSearch("");
  }

  function handleClear() {
    setSelected(null);
    onChange(null);
  }

  if (selected) {
    return (
      <div className={`flex items-center gap-2 rounded-md border border-border bg-secondary px-3 py-2 ${className ?? ""}`}>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate">
            {selected.first_name} {selected.last_name}
          </p>
          {selected.company && (
            <p className="text-xs text-muted-foreground truncate">{selected.company}</p>
          )}
        </div>
        <button
          type="button"
          onClick={handleClear}
          className="text-muted-foreground hover:text-foreground shrink-0"
          aria-label="Clear contact"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    );
  }

  return (
    <div className={`relative ${className ?? ""}`}>
      <Button
        type="button"
        variant="outline"
        className="w-full justify-start text-muted-foreground font-normal"
        onClick={() => setOpen((v) => !v)}
      >
        <Search className="mr-2 h-4 w-4 shrink-0" />
        Search for an agent...
      </Button>

      {open && (
        <div className="absolute z-50 mt-1 w-full rounded-md border border-border bg-background shadow-lg">
          <div className="p-2 border-b border-border">
            <Input
              autoFocus
              placeholder="Type a name or company..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-8 text-sm"
            />
          </div>
          <ul className="max-h-48 overflow-y-auto py-1" role="listbox">
            {filtered.length === 0 ? (
              <li className="px-3 py-2 text-sm text-muted-foreground">No contacts found</li>
            ) : (
              filtered.map((c) => (
                <li key={c.id}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={false}
                    className="w-full text-left px-3 py-2 text-sm hover:bg-secondary transition-colors"
                    onClick={() => handleSelect(c)}
                  >
                    <span className="font-medium">
                      {c.first_name} {c.last_name}
                    </span>
                    {c.company && (
                      <span className="text-muted-foreground ml-1">-- {c.company}</span>
                    )}
                  </button>
                </li>
              ))
            )}
          </ul>
          <div className="p-2 border-t border-border">
            <button
              type="button"
              className="text-xs text-muted-foreground hover:text-foreground"
              onClick={() => setOpen(false)}
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
