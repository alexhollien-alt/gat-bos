import Link from "next/link";
import { Contact, ContactTier } from "@/lib/types";
import { cn } from "@/lib/utils";

// Staleness thresholds by tier. Past these, the row gets a red "needs attention" dot.
const TIER_THRESHOLD_DAYS: Record<string, number> = {
  A: 14,
  B: 21,
  C: 30,
  P: 60,
};
const DEFAULT_THRESHOLD_DAYS = 30;

function isStale(tier: ContactTier | null, lastTouch: string | null): boolean {
  const threshold = tier
    ? TIER_THRESHOLD_DAYS[tier] ?? DEFAULT_THRESHOLD_DAYS
    : DEFAULT_THRESHOLD_DAYS;
  if (!lastTouch) return true;
  const days =
    (Date.now() - new Date(lastTouch).getTime()) / (1000 * 60 * 60 * 24);
  return days > threshold;
}

export function ContactCard({
  contact,
  touchCount,
}: {
  contact: Contact;
  touchCount: number;
}) {
  const stale = isStale(contact.tier, contact.last_touchpoint);
  const touchLabel = touchCount === 1 ? "1 touch" : `${touchCount} touches`;

  return (
    <Link
      href={`/contacts/${contact.id}`}
      className="group flex items-center gap-3 px-4 py-2.5 hover:bg-white/[0.02] transition-colors"
    >
      <span
        className={cn(
          "h-1.5 w-1.5 rounded-full shrink-0",
          stale ? "bg-red-500" : "bg-white/[0.08]",
        )}
        aria-label={stale ? "Needs attention" : undefined}
      />
      <span className="flex-1 text-sm text-foreground truncate group-hover:text-white transition-colors">
        {contact.first_name} {contact.last_name}
      </span>
      <span className="font-mono text-[10px] text-muted-foreground text-right shrink-0 tabular-nums">
        {touchLabel}
      </span>
    </Link>
  );
}
