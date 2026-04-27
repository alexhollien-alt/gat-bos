import type { ParsedIntent, CapturePayload } from "@/lib/types";

export interface ContactIndexEntry {
  id: string;
  first_name: string;
  last_name: string;
}

export interface ParseInput {
  rawText: string;
  contactsIndex: ContactIndexEntry[];
}

export interface ParseResult {
  intent: ParsedIntent;
  contactId: string | null;
  payload: CapturePayload;
}

interface IntentRule {
  intent: Exclude<ParsedIntent, "note" | "unprocessed">;
  keywords: string[];
}

// Ordered: first-match-wins.
const INTENT_RULES: IntentRule[] = [
  {
    intent: "follow_up",
    keywords: ["follow up", "followup", "remind me", "check in", "reach out"],
  },
  {
    intent: "ticket",
    keywords: [
      "ticket",
      "print",
      "design",
      "flyer",
      "brochure",
      "mailer",
      "door hanger",
      "postcard",
      "eddm",
    ],
  },
  {
    intent: "interaction",
    keywords: ["met with", "called", "coffee", "lunch", "spoke to", "texted"],
  },
];

// Escape regex metacharacters so user-controlled names don't blow up the matcher.
function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// Word-boundary case-insensitive match. Returns the index of the first occurrence,
// or -1 if no match. Uses \b so "ticket" doesn't match "ticketed" and "denise"
// doesn't match "denisethompson".
function firstWordBoundaryIndex(haystack: string, needle: string): number {
  if (!needle.trim()) return -1;
  const re = new RegExp(`\\b${escapeRegex(needle)}\\b`, "i");
  const m = re.exec(haystack);
  return m ? m.index : -1;
}

interface ContactMatch {
  contactId: string;
  matchIndex: number;
}

function matchContacts(
  text: string,
  contacts: ContactIndexEntry[]
): ContactMatch[] {
  const matches: ContactMatch[] = [];
  for (const c of contacts) {
    const first = (c.first_name || "").trim();
    const last = (c.last_name || "").trim();
    const full = `${first} ${last}`.trim();

    // Prefer the longest (full name) over single names when computing the
    // match position, but any hit counts.
    const candidates = [full, first, last].filter(Boolean);
    let bestIdx = -1;
    for (const cand of candidates) {
      const idx = firstWordBoundaryIndex(text, cand);
      if (idx !== -1 && (bestIdx === -1 || idx < bestIdx)) {
        bestIdx = idx;
      }
    }
    if (bestIdx !== -1) {
      matches.push({ contactId: c.id, matchIndex: bestIdx });
    }
  }
  matches.sort((a, b) => a.matchIndex - b.matchIndex);
  return matches;
}

function matchIntent(text: string): { intent: ParsedIntent; keyword: string } | null {
  for (const rule of INTENT_RULES) {
    for (const kw of rule.keywords) {
      if (firstWordBoundaryIndex(text, kw) !== -1) {
        return { intent: rule.intent, keyword: kw };
      }
    }
  }
  return null;
}

export function parseCapture(input: ParseInput): ParseResult {
  const { rawText, contactsIndex } = input;
  const text = (rawText || "").toLowerCase();

  const contactMatches = matchContacts(text, contactsIndex);
  const primaryContactId = contactMatches[0]?.contactId ?? null;
  const intentHit = matchIntent(text);

  const payload: CapturePayload = {};
  if (contactMatches.length > 0) {
    payload.candidate_contact_ids = contactMatches.map((m) => m.contactId);
  }
  if (intentHit) {
    payload.intent_keyword = intentHit.keyword;
  }

  let intent: ParsedIntent;
  if (intentHit) {
    intent = intentHit.intent;
  } else if (primaryContactId) {
    intent = "note";
  } else {
    intent = "unprocessed";
  }

  return {
    intent,
    contactId: primaryContactId,
    payload,
  };
}
