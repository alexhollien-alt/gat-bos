// src/lib/open-house/format.ts
// Date/time formatting shared by the email builder and the landing page.
// Phoenix never observes DST, so a fixed -07:00 offset is correct year round.

const TZ = "America/Phoenix";

export interface BlastDateLabels {
  weekday: string; // "Saturday"
  dateLabel: string; // "Saturday, June 14"
  shortDate: string; // "Jun 14"
  iso: string; // original
}

export function formatBlastDate(dateISO: string): BlastDateLabels {
  // dateISO is a Postgres date like "2026-06-14". Anchor at Phoenix noon.
  const d = new Date(`${dateISO}T12:00:00-07:00`);
  const weekday = new Intl.DateTimeFormat("en-US", { weekday: "long", timeZone: TZ }).format(d);
  const dateLabel = new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    timeZone: TZ,
  }).format(d);
  const shortDate = new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    timeZone: TZ,
  }).format(d);
  return { weekday, dateLabel, shortDate, iso: dateISO };
}

function to12h(t: string): string {
  // t is "HH:MM:SS" or "HH:MM"
  const [hStr, mStr] = t.split(":");
  let h = parseInt(hStr, 10);
  const m = parseInt(mStr ?? "0", 10);
  const ampm = h >= 12 ? "PM" : "AM";
  h = h % 12;
  if (h === 0) h = 12;
  return m === 0 ? `${h} ${ampm}` : `${h}:${String(m).padStart(2, "0")} ${ampm}`;
}

export function formatTimeRange(
  start?: string | null,
  end?: string | null,
): string | null {
  if (!start) return null;
  const s = to12h(start);
  if (!end) return s;
  return `${s} to ${to12h(end)}`;
}
