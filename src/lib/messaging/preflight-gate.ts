// Reusable pre-send gate over the preflight primitives in preflight.ts. Builds
// the report, runs image-200 checks, evaluates, and returns a pass/fail with the
// hard failures. Used by every MULTI-RECIPIENT send path so a broken image or an
// unresolved token can never ship to a whole list. (1:1 transactional replies are
// intentionally excluded -- see the Scope 6 decision record.)
import {
  buildPreflightReport,
  checkImageUrls,
  evaluatePreflight,
  type PreflightRecipient,
  type PreflightReport,
} from "./preflight";

export interface PreflightGateInput {
  subject: string;
  html: string;
  recipients: PreflightRecipient[];
  filterDescription: string;
  expectedCount?: number;
}

export interface PreflightGateResult {
  pass: boolean;
  failures: string[];
  warnings: string[];
  report: PreflightReport;
}

export async function runPreflightGate(
  input: PreflightGateInput,
  fetchImpl: typeof fetch = fetch,
): Promise<PreflightGateResult> {
  const report = buildPreflightReport({
    subject: input.subject,
    html: input.html,
    recipients: input.recipients,
    excluded: [],
    filterDescription: input.filterDescription,
    expectedCount: input.expectedCount,
  });
  report.imageChecks = await checkImageUrls(report.imageUrls, fetchImpl);
  const evaluation = evaluatePreflight(report);
  return {
    pass: evaluation.pass,
    failures: evaluation.hardFailures,
    warnings: evaluation.warnings,
    report,
  };
}
