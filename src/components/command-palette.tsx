"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Contact } from "@/lib/types";
import {
  CommandDialog,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandSeparator,
} from "@/components/ui/command";
import {
  Users,
  Phone,
  CheckSquare,
  Clock,
  UserPlus,
  Search,
  TrendingUp,
} from "lucide-react";

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const router = useRouter();

  // Cmd+K listener
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  // Fetch contacts when palette opens
  const fetchContacts = useCallback(async () => {
    const supabase = createClient();
    const { data } = await supabase
      .from("contacts")
      .select("id, first_name, last_name, company, email, phone, temperature, tier")
      .order("first_name", { ascending: true })
      .limit(200);
    if (data) setContacts(data as Contact[]);
  }, []);

  useEffect(() => {
    if (open) fetchContacts();
  }, [open, fetchContacts]);

  function navigate(path: string) {
    setOpen(false);
    router.push(path);
  }

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput placeholder="Search contacts, navigate, or take action..." />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>

        <CommandGroup heading="Quick Actions">
          <CommandItem onSelect={() => navigate("/contacts?action=new")}>
            <UserPlus className="mr-2 h-4 w-4" />
            New Contact
          </CommandItem>
          <CommandItem onSelect={() => navigate("/tasks")}>
            <CheckSquare className="mr-2 h-4 w-4" />
            View Tasks
          </CommandItem>
          <CommandItem onSelect={() => navigate("/follow-ups")}>
            <Clock className="mr-2 h-4 w-4" />
            View Follow-ups
          </CommandItem>
          <CommandItem onSelect={() => navigate("/opportunities")}>
            <TrendingUp className="mr-2 h-4 w-4" />
            View Pipeline
          </CommandItem>
        </CommandGroup>

        <CommandSeparator />

        <CommandGroup heading="Contacts">
          {contacts.map((c) => (
            <CommandItem
              key={c.id}
              value={`${c.first_name} ${c.last_name} ${c.company || ""} ${c.email || ""}`}
              onSelect={() => navigate(`/contacts/${c.id}`)}
            >
              <Users className="mr-2 h-4 w-4" />
              <div className="flex-1 min-w-0">
                <span className="text-sm">
                  {c.first_name} {c.last_name}
                </span>
                {c.company && (
                  <span className="text-xs text-muted-foreground ml-2">
                    {c.company}
                  </span>
                )}
              </div>
              {c.temperature > 0 && (
                <span className="text-xs text-muted-foreground">
                  {c.temperature}°
                </span>
              )}
            </CommandItem>
          ))}
        </CommandGroup>

        <CommandSeparator />

        <CommandGroup heading="Navigate">
          <CommandItem onSelect={() => navigate("/dashboard")}>
            <Search className="mr-2 h-4 w-4" />
            Dashboard
          </CommandItem>
          <CommandItem onSelect={() => navigate("/contacts")}>
            <Users className="mr-2 h-4 w-4" />
            All Contacts
          </CommandItem>
          <CommandItem onSelect={() => navigate("/campaigns")}>
            <Phone className="mr-2 h-4 w-4" />
            Campaigns
          </CommandItem>
          <CommandItem onSelect={() => navigate("/materials")}>
            <CheckSquare className="mr-2 h-4 w-4" />
            Materials
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
