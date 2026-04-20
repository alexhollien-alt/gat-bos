"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { enrollContacts } from "@/app/(app)/campaigns/[id]/actions";
import { Search } from "lucide-react";

type ContactRow = {
  id: string;
  first_name: string;
  last_name: string;
  company: string | null;
};

export function EnrollDialog({
  open,
  onOpenChange,
  campaignId,
  enrolledContactIds,
  onSuccess,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  campaignId: string;
  enrolledContactIds: string[];
  onSuccess: () => void;
}) {
  const [contacts, setContacts] = useState<ContactRow[]>([]);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const supabase = useMemo(() => createClient(), []);

  const fetchContacts = useCallback(async () => {
    const { data } = await supabase
      .from("contacts")
      .select("id, first_name, last_name, company")
      .order("last_name");
    if (data) setContacts(data);
  }, [supabase]);

  useEffect(() => {
    if (open) {
      fetchContacts();
      setSelected([]);
      setSearch("");
    }
  }, [open, fetchContacts]);

  const filtered = contacts.filter((c) => {
    const name = `${c.first_name} ${c.last_name}`.toLowerCase();
    return name.includes(search.toLowerCase());
  });

  function toggleContact(id: string) {
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }

  async function handleEnroll() {
    if (selected.length === 0) return;
    setSaving(true);
    const result = await enrollContacts(campaignId, selected);
    if (result && "error" in result) {
      toast.error("Failed to enroll contacts");
      setSaving(false);
      return;
    }
    toast.success(`${selected.length} contact${selected.length > 1 ? "s" : ""} enrolled`);
    onOpenChange(false);
    onSuccess();
    setSaving(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Enroll Contacts</DialogTitle>
        </DialogHeader>

        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
          <Input
            placeholder="Search contacts..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        <div className="max-h-64 overflow-y-auto space-y-1">
          {filtered.length === 0 ? (
            <p className="text-sm text-slate-400 text-center py-4">
              No contacts found
            </p>
          ) : (
            filtered.map((contact) => {
              const isEnrolled = enrolledContactIds.includes(contact.id);
              const isSelected = selected.includes(contact.id);
              return (
                <label
                  key={contact.id}
                  className={`flex items-center gap-3 rounded-md px-2 py-1.5 text-sm cursor-pointer hover:bg-slate-50 ${
                    isEnrolled ? "opacity-50" : ""
                  }`}
                >
                  <Checkbox
                    checked={isSelected}
                    disabled={isEnrolled}
                    onCheckedChange={() => toggleContact(contact.id)}
                  />
                  <span className="flex-1">
                    {contact.first_name} {contact.last_name}
                  </span>
                  {isEnrolled && (
                    <span className="text-xs text-slate-400">enrolled</span>
                  )}
                </label>
              );
            })
          )}
        </div>

        <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            size="sm"
            disabled={selected.length === 0 || saving}
            onClick={handleEnroll}
          >
            {saving ? "Enrolling..." : `Enroll ${selected.length || ""}`}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
