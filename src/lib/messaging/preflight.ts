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

export interface RawContactRow {
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  brokerage: string | null;
  deleted_at: string | null;
}

export function partitionContacts(rows: RawContactRow[]): {
  included: PreflightRecipient[];
  excluded: ExcludedRecipient[];
} {
  const included: PreflightRecipient[] = [];
  const excluded: ExcludedRecipient[] = [];
  for (const r of rows) {
    const name = `${r.first_name ?? ""} ${r.last_name ?? ""}`.trim() || "(no name)";
    if (r.deleted_at) {
      excluded.push({ email: r.email, name, reason: "soft-deleted" });
      continue;
    }
    if (!r.email || !r.email.trim()) {
      excluded.push({ email: r.email, name, reason: "missing email" });
      continue;
    }
    included.push({ email: r.email.trim(), name });
  }
  return { included, excluded };
}

export async function checkImageUrls(
  urls: string[],
  fetchImpl: typeof fetch = fetch,
): Promise<ImageCheckResult[]> {
  const results: ImageCheckResult[] = [];
  for (const url of urls) {
    const target = url.startsWith("//") ? `https:${url}` : url;
    try {
      const res = await fetchImpl(target, { method: "GET", redirect: "follow" });
      results.push({ url, ok: res.status === 200, status: res.status });
    } catch (err) {
      results.push({
        url,
        ok: false,
        status: null,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }
  return results;
}

export function evaluatePreflight(report: PreflightReport): PreflightEvaluation {
  const hardFailures: string[] = [];
  const warnings: string[] = [];

  if (report.recipientCount === 0) {
    hardFailures.push("Recipient list is empty.");
  }
  if (report.expectedCount !== undefined && report.recipientCount !== report.expectedCount) {
    hardFailures.push(
      `Recipient count ${report.recipientCount} does not match expected ${report.expectedCount}.`,
    );
  }
  if (report.duplicateEmails.length > 0) {
    hardFailures.push(`Duplicate recipient emails: ${report.duplicateEmails.join(", ")}.`);
  }
  if (report.unresolvedTokens.length > 0) {
    hardFailures.push(`Unresolved template tokens: ${report.unresolvedTokens.join(", ")}.`);
  }
  const broken = report.imageChecks.filter((c) => !c.ok);
  if (broken.length > 0) {
    hardFailures.push(
      `Images not returning 200: ${broken.map((c) => `${c.url} (${c.status ?? c.error})`).join("; ")}.`,
    );
  }
  if (report.imageUrls.length > 0 && report.imageChecks.length === 0) {
    hardFailures.push("Image checks not run -- cannot confirm images return 200.");
  }
  if (report.excluded.length === 0) {
    warnings.push("No recipients were excluded -- confirm this is expected.");
  }

  return { pass: hardFailures.length === 0, hardFailures, warnings };
}

export function buildPreflightReport(input: PreflightInput): PreflightReport {
  return {
    filterDescription: input.filterDescription,
    recipientCount: input.recipients.length,
    expectedCount: input.expectedCount,
    recipients: input.recipients,
    excluded: input.excluded,
    duplicateEmails: findDuplicateEmails(input.recipients),
    subject: input.subject,
    bodyPreview: stripHtml(input.html),
    unresolvedTokens: detectUnresolvedTokens(input.subject, input.html),
    imageUrls: extractImageUrls(input.html),
    imageChecks: [],
  };
}
