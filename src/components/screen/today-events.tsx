"use client";

// Phase 1.5 Today's Events widget. Queries the events table for entries whose
// start_at falls within today's window in America/Phoenix, renders them with
// Kit Screen typography, and exposes a "New event" button that posts to
// /api/calendar/create (dashboard is canonical; GCal sync is secondary).
//
// Reads go direct to Supabase (RLS gates Alex). Writes go via API route so
// GCal insert lands server-side with encrypted tokens.
import { useMemo, useState, type FormEvent } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Eyebrow } from "./eyebrow";
import { AccentRule } from "./accent-rule";

interface EventRow {
  id: string;
  gcal_event_id: string | null;
  title: string;
  description: string | null;
  start_at: string;
  end_at: string;
  location: string | null;
  project_id: string | null;
  contact_id: string | null;
  source: "gcal_pull" | "dashboard_create";
}

const TIME_FORMATTER = new Intl.DateTimeFormat("en-US", {
  hour: "numeric",
  minute: "2-digit",
  timeZone: "America/Phoenix",
});

function todayWindowAz(): { startIso: string; endIso: string } {
  const azMidnight = new Date(
    new Date().toLocaleString("en-US", { timeZone: "America/Phoenix" }),
  );
  azMidnight.setHours(0, 0, 0, 0);
  const azEnd = new Date(azMidnight);
  azEnd.setHours(23, 59, 59, 999);
  return { startIso: azMidnight.toISOString(), endIso: azEnd.toISOString() };
}

function formatTimeRange(startIso: string, endIso: string): string {
  return `${TIME_FORMATTER.format(new Date(startIso))} -- ${TIME_FORMATTER.format(new Date(endIso))}`;
}

function isoLocalInputToIso(value: string): string {
  // <input type="datetime-local"> emits "YYYY-MM-DDTHH:mm" in local tz.
  if (!value) return "";
  const local = new Date(value);
  if (Number.isNaN(local.getTime())) return "";
  return local.toISOString();
}

export function TodayEvents() {
  const supabase = useMemo(() => createClient(), []);
  const queryClient = useQueryClient();
  const window = useMemo(() => todayWindowAz(), []);

  const { data, isLoading, error } = useQuery<EventRow[]>({
    queryKey: ["events", "today", window.startIso],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("events")
        .select(
          "id, gcal_event_id, title, description, start_at, end_at, location, project_id, contact_id, source",
        )
        .is("deleted_at", null)
        .gte("start_at", window.startIso)
        .lte("start_at", window.endIso)
        .order("start_at", { ascending: true });
      if (error) throw new Error(error.message);
      return (data ?? []) as EventRow[];
    },
    staleTime: 30 * 1000,
  });

  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [form, setForm] = useState({
    title: "",
    description: "",
    location: "",
    start_at: "",
    end_at: "",
  });

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitting(true);
    setFormError(null);

    const startIso = isoLocalInputToIso(form.start_at);
    const endIso = isoLocalInputToIso(form.end_at);
    if (!form.title.trim() || !startIso || !endIso) {
      setFormError("Title, start, and end are required");
      setSubmitting(false);
      return;
    }

    try {
      const res = await fetch("/api/calendar/create", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          title: form.title.trim(),
          description: form.description.trim() || undefined,
          location: form.location.trim() || undefined,
          start_at: startIso,
          end_at: endIso,
        }),
      });
      if (!res.ok) {
        const payload = (await res.json().catch(() => ({ error: "Create failed" }))) as {
          error?: string;
        };
        throw new Error(payload.error ?? "Create failed");
      }
      await queryClient.invalidateQueries({ queryKey: ["events", "today"] });
      setForm({ title: "", description: "", location: "", start_at: "", end_at: "" });
      setOpen(false);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Create failed");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="rounded-lg border border-border bg-card/40 p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <Eyebrow>Today</Eyebrow>
          <h2 className="mt-1 font-display text-2xl tracking-tight">Calendar</h2>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button variant="outline" size="sm">
              New event
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>New event</DialogTitle>
              <DialogDescription>
                Creates locally first, then mirrors to Google Calendar.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1">
                <Label htmlFor="event-title">Title</Label>
                <Input
                  id="event-title"
                  value={form.title}
                  onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label htmlFor="event-start">Start</Label>
                  <Input
                    id="event-start"
                    type="datetime-local"
                    value={form.start_at}
                    onChange={(e) => setForm((f) => ({ ...f, start_at: e.target.value }))}
                    required
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="event-end">End</Label>
                  <Input
                    id="event-end"
                    type="datetime-local"
                    value={form.end_at}
                    onChange={(e) => setForm((f) => ({ ...f, end_at: e.target.value }))}
                    required
                  />
                </div>
              </div>
              <div className="space-y-1">
                <Label htmlFor="event-location">Location</Label>
                <Input
                  id="event-location"
                  value={form.location}
                  onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))}
                  placeholder="Optional"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="event-description">Description</Label>
                <Textarea
                  id="event-description"
                  value={form.description}
                  onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                  rows={3}
                  placeholder="Optional"
                />
              </div>
              {formError ? (
                <p className="text-sm text-destructive" role="alert">
                  {formError}
                </p>
              ) : null}
              <DialogFooter>
                <DialogClose asChild>
                  <Button type="button" variant="ghost" disabled={submitting}>
                    Cancel
                  </Button>
                </DialogClose>
                <Button type="submit" disabled={submitting}>
                  {submitting ? "Creating..." : "Create"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <AccentRule className="my-4" />

      {isLoading ? (
        <p className="font-mono text-xs uppercase tracking-wider text-muted-foreground">Loading...</p>
      ) : error ? (
        <p className="font-mono text-xs uppercase tracking-wider text-destructive">
          {error instanceof Error ? error.message : "Failed to load events"}
        </p>
      ) : !data || data.length === 0 ? (
        <p className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
          No events today
        </p>
      ) : (
        <ul className="space-y-3">
          {data.map((event) => (
            <li key={event.id} className="flex items-baseline gap-4">
              <span className="font-mono text-xs uppercase tracking-wider text-muted-foreground whitespace-nowrap">
                {formatTimeRange(event.start_at, event.end_at)}
              </span>
              <span className="flex-1">
                <span className="font-sans text-sm font-medium">{event.title}</span>
                {event.location ? (
                  <span className="ml-2 font-sans text-xs text-muted-foreground">
                    · {event.location}
                  </span>
                ) : null}
                {event.gcal_event_id === null && event.source === "dashboard_create" ? (
                  <span
                    className="ml-2 font-mono text-[10px] uppercase tracking-wider text-amber-500"
                    title="Google Calendar write pending"
                  >
                    · pending sync
                  </span>
                ) : null}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
