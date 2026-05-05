"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { formatDistanceToNow, format } from "date-fns";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PageHeader, AccentRule } from "@/components/screen";
import {
  TICKET_STATUSES,
  TICKET_PRIORITIES,
  CYPHER_BRANCHES,
  CYPHER_SHIP_TO_LOCATIONS,
  type TicketStatus,
} from "@/lib/cypher-constants";
import { ArrowLeft, ExternalLink, Pencil, Trash2, X, Check } from "lucide-react";

type TicketProject = {
  id: string;
  project_number: number;
  category: string;
  product: string;
  quantity: number | null;
  total_project_cost: number | null;
};

type TicketFull = {
  id: string;
  ticket_title: string;
  description: string;
  status: TicketStatus;
  priority: string;
  due_date: string | null;
  branch_association: string;
  ship_to_location: string;
  cypher_id: string | null;
  cypher_url: string | null;
  contact_id: string | null;
  client_first_name: string | null;
  client_last_name: string | null;
  client_company: string | null;
  client_email: string | null;
  client_phone: string | null;
  client_mobile_phone: string | null;
  assigned_to: string | null;
  raw_brain_dump: string | null;
  created_at: string;
  updated_at: string;
  synced_at: string | null;
  ticket_projects: TicketProject[];
};

type ActivityRow = {
  id: string;
  verb: string;
  occurred_at: string;
  context: Record<string, unknown> | null;
};

const STATUS_STYLES: Record<TicketStatus, string> = {
  draft: "bg-muted text-muted-foreground",
  submitted: "bg-blue-500/15 text-blue-600 dark:text-blue-400",
  awaiting_reply: "bg-yellow-500/15 text-yellow-600 dark:text-yellow-400",
  in_progress: "bg-indigo-500/15 text-indigo-600 dark:text-indigo-400",
  done: "bg-green-500/15 text-green-600 dark:text-green-400",
  blocked: "bg-red-500/15 text-red-600 dark:text-red-400",
  cancelled: "bg-muted text-muted-foreground",
};

const STATUS_LABELS: Record<TicketStatus, string> = {
  draft: "Draft",
  submitted: "Submitted",
  awaiting_reply: "Awaiting Reply",
  in_progress: "In Progress",
  done: "Done",
  blocked: "Blocked",
  cancelled: "Cancelled",
};

function verbLabel(verb: string, ctx: Record<string, unknown> | null): string {
  switch (verb) {
    case "ticket.created": return "Ticket created";
    case "ticket.status_changed":
      return `Status changed: ${ctx?.old_status} -> ${ctx?.new_status}`;
    case "ticket.field_updated": {
      const fields = ctx?.fields_updated;
      return `Updated: ${Array.isArray(fields) ? fields.join(", ") : "fields"}`;
    }
    case "ticket.deleted": return "Ticket deleted";
    case "ticket.synced": return "Synced to Cypher";
    case "ticket.cypher_id_assigned":
      return `Cypher ID assigned: ${ctx?.cypher_id ?? ""}`;
    case "ticket.notes_updated": return "Notes updated";
    default: return verb;
  }
}

export function TicketDetail({ id }: { id: string }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const supabase = useMemo(() => createClient(), []);
  const [editingField, setEditingField] = useState<string | null>(null);
  const [editValue, setEditValue] = useState<string>("");
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const { data: ticket, isLoading } = useQuery({
    queryKey: ["tickets", id],
    queryFn: async () => {
      const res = await fetch(`/api/tickets/${id}`);
      if (!res.ok) throw new Error("Failed to load ticket");
      const json = await res.json();
      return json.ticket as TicketFull;
    },
    staleTime: 30 * 1000,
  });

  const { data: activity = [] } = useQuery({
    queryKey: ["tickets", id, "activity"],
    queryFn: async () => {
      const { data } = await supabase
        .from("activity_events")
        .select("id, verb, occurred_at, context")
        .eq("object_id", id)
        .eq("object_table", "tickets")
        .order("occurred_at", { ascending: false })
        .limit(20);
      return (data ?? []) as ActivityRow[];
    },
    staleTime: 30 * 1000,
    enabled: !!ticket,
  });

  async function patchField(field: string, value: string | null) {
    setSaving(true);
    const res = await fetch(`/api/tickets/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ [field]: value }),
    });
    setSaving(false);
    if (!res.ok) {
      toast.error("Failed to save");
      return;
    }
    await queryClient.invalidateQueries({ queryKey: ["tickets", id] });
    await queryClient.invalidateQueries({ queryKey: ["tickets", id, "activity"] });
    setEditingField(null);
    toast.success("Saved");
  }

  async function handleDelete() {
    if (!confirm("Delete this ticket? The record will be archived.")) return;
    setDeleting(true);
    const res = await fetch(`/api/tickets/${id}`, { method: "DELETE" });
    if (!res.ok) {
      toast.error("Failed to delete");
      setDeleting(false);
      return;
    }
    await queryClient.invalidateQueries({ queryKey: ["tickets"] });
    toast.success("Ticket archived");
    router.push("/tickets");
  }

  function startEdit(field: string, current: string) {
    setEditingField(field);
    setEditValue(current);
  }

  function cancelEdit() {
    setEditingField(null);
    setEditValue("");
  }

  if (isLoading) {
    return (
      <div className="py-16 text-center text-muted-foreground text-sm">Loading...</div>
    );
  }

  if (!ticket) {
    return (
      <div className="py-16 text-center space-y-3">
        <p className="text-muted-foreground">Ticket not found.</p>
        <Button asChild variant="outline" size="sm">
          <Link href="/tickets"><ArrowLeft className="mr-2 h-4 w-4" />Back to Tickets</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start gap-4">
        <Button asChild variant="ghost" size="sm" className="-ml-2 mt-0.5">
          <Link href="/tickets"><ArrowLeft className="h-4 w-4" /></Link>
        </Button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 flex-wrap">
            <span
              className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_STYLES[ticket.status]}`}
            >
              {STATUS_LABELS[ticket.status]}
            </span>
            {ticket.cypher_id ? (
              <span className="font-mono text-xs text-muted-foreground">{ticket.cypher_id}</span>
            ) : (
              <span className="font-mono text-xs text-muted-foreground/40">No Cypher ID</span>
            )}
          </div>
          <PageHeader size="md" title={ticket.ticket_title} className="mt-1" />
          <p className="text-xs text-muted-foreground mt-1">
            Created {formatDistanceToNow(new Date(ticket.created_at), { addSuffix: true })} --
            updated {formatDistanceToNow(new Date(ticket.updated_at), { addSuffix: true })}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button
            variant="outline"
            size="sm"
            disabled
            title="Cypher push available in Slice C"
            className="gap-2 opacity-50"
          >
            <ExternalLink className="h-3.5 w-3.5" />
            Push to Cypher
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleDelete}
            disabled={deleting}
            className="text-muted-foreground hover:text-destructive"
            aria-label="Delete ticket"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <AccentRule />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main column */}
        <div className="lg:col-span-2 space-y-6">
          {/* Description */}
          <section className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs uppercase tracking-wider text-muted-foreground font-mono">Description</Label>
              {editingField !== "description" && (
                <button
                  type="button"
                  onClick={() => startEdit("description", ticket.description)}
                  className="text-muted-foreground hover:text-foreground"
                  aria-label="Edit description"
                >
                  <Pencil className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
            {editingField === "description" ? (
              <div className="space-y-2">
                <Textarea
                  rows={5}
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  autoFocus
                />
                <div className="flex gap-2">
                  <Button size="sm" disabled={saving} onClick={() => patchField("description", editValue)}>
                    <Check className="h-3.5 w-3.5 mr-1" />{saving ? "Saving..." : "Save"}
                  </Button>
                  <Button size="sm" variant="ghost" onClick={cancelEdit} disabled={saving}>
                    <X className="h-3.5 w-3.5 mr-1" />Cancel
                  </Button>
                </div>
              </div>
            ) : (
              <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">{ticket.description}</p>
            )}
          </section>

          {/* Brain dump */}
          {ticket.raw_brain_dump && (
            <section className="space-y-2">
              <Label className="text-xs uppercase tracking-wider text-muted-foreground font-mono">Brain Dump</Label>
              <p className="text-sm text-muted-foreground whitespace-pre-wrap leading-relaxed bg-secondary/40 rounded-md p-3">
                {ticket.raw_brain_dump}
              </p>
            </section>
          )}

          {/* Projects */}
          <section className="space-y-3">
            <Label className="text-xs uppercase tracking-wider text-muted-foreground font-mono">
              Projects ({ticket.ticket_projects.length})
            </Label>
            <div className="space-y-2">
              {ticket.ticket_projects.map((p) => (
                <div key={p.id} className="rounded-lg border border-border bg-secondary/30 px-4 py-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium font-mono">Project {p.project_number}</span>
                    <span className="text-xs text-muted-foreground">{p.category}</span>
                  </div>
                  <p className="text-sm text-foreground mt-0.5">{p.product}</p>
                  <div className="flex gap-4 mt-1 text-xs text-muted-foreground">
                    {p.quantity && <span>Qty: {p.quantity}</span>}
                    {p.total_project_cost != null && <span>${p.total_project_cost.toFixed(2)}</span>}
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Activity Feed */}
          <section className="space-y-3">
            <Label className="text-xs uppercase tracking-wider text-muted-foreground font-mono">Activity</Label>
            {activity.length === 0 ? (
              <p className="text-sm text-muted-foreground">No activity yet.</p>
            ) : (
              <ol className="space-y-2" aria-label="Ticket activity">
                {activity.map((event) => (
                  <li key={event.id} className="flex gap-3 items-start">
                    <div className="mt-1.5 h-1.5 w-1.5 rounded-full bg-muted-foreground/40 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-foreground">
                        {verbLabel(event.verb, event.context)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {formatDistanceToNow(new Date(event.occurred_at), { addSuffix: true })}
                      </p>
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </section>
        </div>

        {/* Sidebar */}
        <aside className="space-y-5">
          {/* Status */}
          <div className="space-y-1.5">
            <Label className="text-xs uppercase tracking-wider text-muted-foreground font-mono">Status</Label>
            <Select
              value={ticket.status}
              onValueChange={(v) => patchField("status", v)}
            >
              <SelectTrigger className="h-8 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TICKET_STATUSES.map((s) => (
                  <SelectItem key={s} value={s}>{STATUS_LABELS[s]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Priority */}
          <div className="space-y-1.5">
            <Label className="text-xs uppercase tracking-wider text-muted-foreground font-mono">Priority</Label>
            <Select
              value={ticket.priority}
              onValueChange={(v) => patchField("priority", v)}
            >
              <SelectTrigger className="h-8 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TICKET_PRIORITIES.map((p) => (
                  <SelectItem key={p} value={p}>{p}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Due date */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label className="text-xs uppercase tracking-wider text-muted-foreground font-mono">Due Date</Label>
              {editingField !== "due_date" && (
                <button
                  type="button"
                  onClick={() => startEdit("due_date", ticket.due_date ?? "")}
                  className="text-muted-foreground hover:text-foreground"
                  aria-label="Edit due date"
                >
                  <Pencil className="h-3 w-3" />
                </button>
              )}
            </div>
            {editingField === "due_date" ? (
              <div className="space-y-1.5">
                <Input
                  type="date"
                  className="h-8 text-sm"
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  autoFocus
                />
                <div className="flex gap-1.5">
                  <Button size="sm" className="h-7 text-xs" disabled={saving} onClick={() => patchField("due_date", editValue || null)}>
                    Save
                  </Button>
                  <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={cancelEdit} disabled={saving}>Cancel</Button>
                </div>
              </div>
            ) : (
              <p className="text-sm text-foreground font-mono">
                {ticket.due_date
                  ? format(new Date(ticket.due_date), "MMM d, yyyy")
                  : <span className="text-muted-foreground/50">Not set</span>}
              </p>
            )}
          </div>

          {/* Branch */}
          <div className="space-y-1.5">
            <Label className="text-xs uppercase tracking-wider text-muted-foreground font-mono">Branch</Label>
            <Select
              value={ticket.branch_association}
              onValueChange={(v) => patchField("branch_association", v)}
            >
              <SelectTrigger className="h-8 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="max-h-60">
                {CYPHER_BRANCHES.map((b) => (
                  <SelectItem key={b} value={b}>{b}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Ship To */}
          <div className="space-y-1.5">
            <Label className="text-xs uppercase tracking-wider text-muted-foreground font-mono">Ship To</Label>
            <Select
              value={ticket.ship_to_location}
              onValueChange={(v) => patchField("ship_to_location", v)}
            >
              <SelectTrigger className="h-8 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="max-h-60">
                {CYPHER_SHIP_TO_LOCATIONS.map((s) => (
                  <SelectItem key={s} value={s}>{s}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Agent */}
          {(ticket.client_first_name || ticket.client_last_name || ticket.client_company) && (
            <div className="space-y-1 rounded-lg border border-border p-3">
              <Label className="text-xs uppercase tracking-wider text-muted-foreground font-mono">Agent</Label>
              {(ticket.client_first_name || ticket.client_last_name) && (
                <p className="text-sm font-medium">
                  {ticket.client_first_name} {ticket.client_last_name}
                </p>
              )}
              {ticket.client_company && (
                <p className="text-xs text-muted-foreground">{ticket.client_company}</p>
              )}
              {ticket.client_email && (
                <a href={`mailto:${ticket.client_email}`} className="text-xs text-primary block hover:underline">
                  {ticket.client_email}
                </a>
              )}
              {ticket.client_phone && (
                <p className="text-xs text-muted-foreground">{ticket.client_phone}</p>
              )}
              {ticket.contact_id && (
                <Button asChild variant="ghost" size="sm" className="h-6 text-xs px-0 mt-1">
                  <Link href={`/contacts/${ticket.contact_id}`}>View Contact</Link>
                </Button>
              )}
            </div>
          )}

          {/* Cypher metadata */}
          <div className="space-y-1 text-xs text-muted-foreground border-t border-border pt-4">
            <p>Cypher ID: <span className="font-mono">{ticket.cypher_id ?? "--"}</span></p>
            {ticket.synced_at && (
              <p>Last synced: {format(new Date(ticket.synced_at), "MMM d, h:mm a")}</p>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
