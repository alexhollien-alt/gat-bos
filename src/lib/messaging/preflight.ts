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
