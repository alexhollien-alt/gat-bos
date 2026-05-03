// src/lib/campaigns/render-weekly-edge.ts
// Slice 8 Phase 4 -- assemble Weekly Edge campaign body from one or more
// (snapshot, narrative) pairs and the seeded `weekly-edge` template.
//
// Pipeline:
//   1. resolve template via slug+max(version) (mirrors src/lib/messaging/send.ts).
//   2. build template variable map: opener + featured-section HTML chunks
//      derived from writer narrative; placeholder bracketed markers for the
//      visual slots (stats_image_html, weekender_image_html,
//      listings_section_html). Reviewer fills those before approving the
//      draft, per Standing Rule 1 (fill-and-flag).
//   3. renderTemplate() -> { subject, body_html, body_text }.
//
// The renderer never invents data. When the writer returned a
// pending_credentials placeholder, the rendered draft surfaces a visible
// "PENDING ALTOS DATA" banner so the reviewer rejects it before send.

import { adminClient } from "@/lib/supabase/admin";
import { renderTemplate } from "@/lib/messaging/render";
import type { TemplateRow } from "@/lib/messaging/types";
import type {
  WeeklyEdgeNarrative,
  WeeklySnapshotRow,
} from "@/lib/ai/weekly-edge-writer";

export interface MarketRender {
  snapshot: WeeklySnapshotRow;
  narrative: WeeklyEdgeNarrative;
  pending_credentials: boolean;
}

export interface RenderedCampaign {
  templateId: string;
  templateSlug: string;
  templateVersion: number;
  subject: string;
  body_html: string;
  body_text: string;
  variables: Record<string, string>;
  unresolved_html: string[];
  unresolved_text: string[];
  unresolved_subject: string[];
}

const PLACEHOLDER_STATS_IMAGE = `<div style="padding: 32px; border: 2px dashed #e63550; color: #e63550; font-family: 'Inter', Arial, sans-serif; font-size: 13px; text-align: center;">[REVIEWER: paste GAT Market Stats image / chart HTML here before approving]</div>`;

const PLACEHOLDER_WEEKENDER_IMAGE = `<div style="padding: 32px; border: 2px dashed #2563eb; color: #2563eb; font-family: 'Inter', Arial, sans-serif; font-size: 13px; text-align: center;">[REVIEWER: paste Weekender image / preview HTML here before approving]</div>`;

const PLACEHOLDER_LISTINGS_SECTION = `<table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%"><tr><td style="padding: 24px; border: 2px dashed #71717a; color: #71717a; font-family: 'Inter', Arial, sans-serif; font-size: 13px; text-align: center;">[REVIEWER: paste this week's featured listings HTML here, or remove the section before approving]</td></tr></table>`;

async function resolveWeeklyEdgeTemplate(): Promise<TemplateRow> {
  const { data, error } = await adminClient
    .from("templates")
    .select("*")
    .eq("slug", "weekly-edge")
    .is("deleted_at", null)
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle<TemplateRow>();
  if (error) throw new Error(`Template lookup failed: ${error.message}`);
  if (!data) throw new Error("Template not found: weekly-edge");
  return data;
}

function isoWeekNumber(weekOf: string): number {
  // weekOf is the ISO Monday yyyy-mm-dd
  const d = new Date(`${weekOf}T00:00:00Z`);
  const target = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const dayNr = (target.getUTCDay() + 6) % 7;
  target.setUTCDate(target.getUTCDate() - dayNr + 3);
  const firstThursday = new Date(Date.UTC(target.getUTCFullYear(), 0, 4));
  const diff = target.getTime() - firstThursday.getTime();
  return 1 + Math.round(diff / (7 * 24 * 60 * 60 * 1000));
}

function formatLong(weekOf: string): string {
  const d = new Date(`${weekOf}T00:00:00Z`);
  return d.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

function formatMetadata(weekOf: string): string {
  const d = new Date(`${weekOf}T00:00:00Z`);
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function buildOpenerHtml(markets: MarketRender[]): string {
  if (markets.length === 0) return "[REVIEWER: no market narratives available -- write opener manually]";
  const lead = markets[0];
  if (lead.pending_credentials) {
    return `<strong style="color: #e63550;">PENDING ALTOS DATA.</strong> The data pull for ${escapeHtml(lead.snapshot.market_label)} returned a credentials placeholder. Reject this draft and send after the Altos integration lands.`;
  }
  const blockHtml = escapeHtml(lead.narrative.market_block).replace(/\n\n+/g, "</p><p style=\"margin: 0 0 16px 0;\">");
  return `<p style="margin: 0 0 16px 0;">${blockHtml}</p>`;
}

function buildFeaturedSectionHtml(markets: MarketRender[]): string {
  if (markets.length === 0) return "[REVIEWER: featured section empty]";
  const lead = markets[0];
  const headline = escapeHtml(lead.narrative.headline);
  const closing = escapeHtml(lead.narrative.closing);
  const callouts = lead.narrative.data_callouts
    .map((c) => `
      <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="display: inline-block; margin: 0 12px 12px 0; vertical-align: top; min-width: 150px; background-color: #131316; padding: 16px;">
        <tr><td style="font-family: 'Inter', Arial, sans-serif; font-size: 10px; font-weight: 600; color: #a1a1aa; letter-spacing: 0.12em; text-transform: uppercase;">${escapeHtml(c.label)}</td></tr>
        <tr><td style="padding-top: 6px; font-family: 'Syne', Arial, sans-serif; font-size: 24px; font-weight: 700; color: #f4f4f5;">${escapeHtml(c.value)}</td></tr>
        <tr><td style="padding-top: 4px; font-family: 'Space Mono', 'Courier New', monospace; font-size: 11px; color: ${c.delta.startsWith("-") ? "#e63550" : "#2563eb"};">${escapeHtml(c.delta || "&mdash;")}</td></tr>
      </table>`)
    .join("");
  return `
    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
      <tr><td><span style="font-family: 'Inter', Arial, sans-serif; font-size: 11px; font-weight: 600; color: #e63550; letter-spacing: 0.12em; text-transform: uppercase;">FEATURED MARKET</span></td></tr>
      <tr><td style="padding-top: 8px; padding-bottom: 16px; font-family: 'Syne', Arial, sans-serif; font-size: 28px; font-weight: 700; color: #f4f4f5; line-height: 1.2;">${headline}</td></tr>
      <tr><td style="padding-bottom: 20px;">${callouts}</td></tr>
      <tr><td style="font-family: 'Inter', Arial, sans-serif; font-size: 14px; font-weight: 400; color: #a1a1aa; line-height: 1.7;">${closing}</td></tr>
    </table>`;
}

function buildPlainText(markets: MarketRender[], issueNumber: number, issueDateLong: string): string {
  const header = `THE WEEKLY EDGE -- Issue #${issueNumber} -- ${issueDateLong}\n\nGreat American Title Agency, Phoenix Valley\n\n`;
  const blocks = markets.map((m) => {
    if (m.pending_credentials) {
      return `[PENDING ALTOS DATA -- ${m.snapshot.market_label}]\n`;
    }
    const callouts = m.narrative.data_callouts
      .map((c) => `  ${c.label}: ${c.value}${c.delta ? ` (${c.delta})` : ""}`)
      .join("\n");
    return [
      `MARKET: ${m.snapshot.market_label}`,
      ``,
      m.narrative.headline,
      ``,
      m.narrative.market_block,
      ``,
      callouts,
      ``,
      m.narrative.closing,
    ].join("\n");
  });
  const footer = `\n\n--\nText Alex now: 480-204-2983\nGreat American Title Agency`;
  return header + blocks.join("\n\n---\n\n") + footer;
}

export interface RenderInput {
  weekOf: string;
  issueNumber: number;
  markets: MarketRender[];
}

export async function renderWeeklyEdge(input: RenderInput): Promise<RenderedCampaign> {
  const template = await resolveWeeklyEdgeTemplate();
  const issueDateLong = formatLong(input.weekOf);
  const issueDateMetadata = formatMetadata(input.weekOf);

  const variables: Record<string, string> = {
    issue_number: String(input.issueNumber),
    issue_date_long: issueDateLong,
    issue_date_metadata: issueDateMetadata,
    opener_html: buildOpenerHtml(input.markets),
    stats_image_html: PLACEHOLDER_STATS_IMAGE,
    weekender_image_html: PLACEHOLDER_WEEKENDER_IMAGE,
    featured_section_html: buildFeaturedSectionHtml(input.markets),
    listings_section_html: PLACEHOLDER_LISTINGS_SECTION,
  };

  const subjectRender = renderTemplate(template.subject, variables);
  const htmlRender = renderTemplate(template.body_html, variables);
  const textRender = renderTemplate(
    template.body_text || buildPlainText(input.markets, input.issueNumber, issueDateLong),
    variables,
  );

  return {
    templateId: template.id,
    templateSlug: template.slug,
    templateVersion: template.version,
    subject: subjectRender.output,
    body_html: htmlRender.output,
    body_text: textRender.output,
    variables,
    unresolved_html: htmlRender.unresolved,
    unresolved_text: textRender.unresolved,
    unresolved_subject: subjectRender.unresolved,
  };
}

export function deriveIssueNumber(weekOf: string): number {
  return isoWeekNumber(weekOf);
}
