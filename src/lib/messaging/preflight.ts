export interface PreflightRecipient {
  email: string;
  name: string;
}

export interface ExcludedRecipient {
  email: string | null;
  name: string;
  reason: string;
}

export interface ImageCheckResult {
  url: string;
  ok: boolean;
  status: number | null;
  error?: string;
}

export interface PreflightInput {
  subject: string;
  html: string;
  recipients: PreflightRecipient[];
  excluded: ExcludedRecipient[];
  filterDescription: string;
  expectedCount?: number;
}

export interface PreflightReport {
  filterDescription: string;
  recipientCount: number;
  expectedCount?: number;
  recipients: PreflightRecipient[];
  excluded: ExcludedRecipient[];
  duplicateEmails: string[];
  subject: string;
  bodyPreview: string;
  unresolvedTokens: string[];
  imageUrls: string[];
  imageChecks: ImageCheckResult[];
}

export interface PreflightEvaluation {
  pass: boolean;
  hardFailures: string[];
  warnings: string[];
}

function addUrl(set: Set<string>, raw: string): void {
  const u = raw.trim();
  if (/^https?:\/\//i.test(u) || u.startsWith("//")) set.add(u);
}

export function extractImageUrls(html: string): string[] {
  const urls = new Set<string>();
  const attrRe = /(?:src|background)\s*=\s*(?:"([^"]+)"|'([^']+)')/gi;
  const cssRe = /url\(\s*['"]?([^'")\s]+)['"]?\s*\)/gi;
  let m: RegExpExecArray | null;
  while ((m = attrRe.exec(html)) !== null) addUrl(urls, m[1] ?? m[2]);
  while ((m = cssRe.exec(html)) !== null) addUrl(urls, m[1]);
  return [...urls];
}

export function stripHtml(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&#39;/g, "'")
    .replace(/&quot;/gi, '"')
    .replace(/\s+/g, " ")
    .trim();
}

export function detectUnresolvedTokens(...parts: string[]): string[] {
  const re = /\{\{\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*\}\}/g;
  const found = new Set<string>();
  for (const part of parts) {
    let m: RegExpExecArray | null;
    while ((m = re.exec(part)) !== null) found.add(m[1]);
  }
  return [...found];
}

export function findDuplicateEmails(recipients: PreflightRecipient[]): string[] {
  const counts = new Map<string, number>();
  for (const r of recipients) {
    const key = r.email.trim().toLowerCase();
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return [...counts.entries()].filter(([, n]) => n > 1).map(([email]) => email);
}
