// Phase 1.3.1 contact filter.
// Order: bulk exclusion -> contact match -> domain match -> no match.

export const RE_DOMAIN_PATTERN =
  /@(keller|compass|realogy|remax|sothebys|longandfoster|barrettonline|mygroup|coldwell|era|davisco|arizonazipcode|gmail|yahoo|outlook)/i;

export const BULK_FROM_PATTERN = /^(no-?reply|noreply|alerts|notifications)@/i;

export const BULK_NAME_TOKENS = [
  "newsletter",
  "noreply",
  "alerts",
  "notifications",
  "team",
];

export type FilterVerdict =
  | { include: true; reason: "contact_match"; contactId: string }
  | { include: true; reason: "domain_match" }
  | { include: false; reason: "bulk_mail" | "no_match" | "unsubscribe_link" };

export interface FilterInput {
  fromEmail: string;
  fromName: string;
  bodyPlain: string;
  subject: string;
  contactIdByEmail: Map<string, string>;
}

export function classifyEmail(input: FilterInput): FilterVerdict {
  const fromEmail = input.fromEmail.trim().toLowerCase();
  const fromName = (input.fromName ?? "").trim().toLowerCase();

  if (BULK_FROM_PATTERN.test(fromEmail)) return { include: false, reason: "bulk_mail" };
  if (BULK_NAME_TOKENS.some((tok) => fromName.includes(tok))) {
    return { include: false, reason: "bulk_mail" };
  }
  if (/\bunsubscribe\b/i.test(input.bodyPlain)) {
    return { include: false, reason: "unsubscribe_link" };
  }

  const contactId = input.contactIdByEmail.get(fromEmail);
  if (contactId) return { include: true, reason: "contact_match", contactId };

  if (RE_DOMAIN_PATTERN.test(fromEmail)) return { include: true, reason: "domain_match" };

  return { include: false, reason: "no_match" };
}

export function extractDomain(email: string): string | null {
  const at = email.lastIndexOf("@");
  if (at < 0) return null;
  return email.slice(at + 1).toLowerCase();
}
