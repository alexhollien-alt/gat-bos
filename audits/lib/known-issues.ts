export type KnownIssue = {
  id: string;
  status: "yellow" | "red";
  since: string;
  pointer: string;
  description: string;
};

export const KNOWN_ISSUES: KnownIssue[] = [
  {
    id: "resend-webhook-broken",
    status: "yellow",
    since: "2026-05-04",
    pointer: "~/.claude/rules/STATUS.md",
    description:
      "Resend webhook handler not receiving events. Zero message_events rows since 2026-05-04 send. Open config gate: verify endpoint URL, signing secret matches RESEND_WEBHOOK_SECRET in Vercel Production env, endpoint enabled.",
  },
  {
    id: "cypher-pull-worker-parked",
    status: "yellow",
    since: "2026-05-05",
    pointer: "~/.claude/memory/loose_ends_2026_05_19_slice_b_gates.md",
    description:
      "Slice B Cypher Pull Worker PARKED until 2026-05-19. Gates 1/2/3/7/8/9/10 closed; gates 4/5/6 burn-in blocked. PR #38 (afb5ced) seeded tickets table. No live pull-worker cron expected before 2026-05-19.",
  },
];

export function isKnownIssue(id: string): KnownIssue | undefined {
  return KNOWN_ISSUES.find((k) => k.id === id);
}
