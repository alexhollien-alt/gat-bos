"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import {
  startOfWeek,
  format,
  subDays,
  subWeeks,
  startOfMonth,
  endOfMonth,
  differenceInDays,
} from "date-fns";
import { AccentRule, PageHeader, SectionShell } from "@/components/screen";

// ---------------------
// Color tokens (screen values per digital-aesthetic.md)
// ---------------------
const CRIMSON = "var(--accent-red)";
const SIGNAL_BLUE = "var(--accent-blue)";
const SUCCESS = "var(--status-success)";
const WARNING = "var(--status-warning)";
const MUTED = "var(--text-muted)";

// ---------------------
// Helpers
// ---------------------
function formatDollar(value: number): string {
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(0)}K`;
  return `$${value}`;
}

function openRateColor(rate: number): string {
  if (rate >= 25) return SUCCESS;
  if (rate >= 15) return WARNING;
  return CRIMSON;
}

const CHART_STYLE = {
  fontFamily: "var(--font-mono)",
  fontSize: 11,
};

// ---------------------
// Types
// ---------------------
interface TempContact {
  id: string;
  first_name: string;
  last_name: string;
  health_score: number;
  recent_interactions: number;
  prior_interactions: number;
}

interface PipelineStageDatum {
  stage: string;
  value: number;
  count: number;
}

interface ThroughputWeek {
  week: string;
  submitted: number;
  completed: number;
}

interface CampaignRow {
  id: string;
  name: string;
  status: string;
  sent: number;
  opened: number;
  openRate: number;
}

// ---------------------
// Sub-components
// ---------------------

/** Small uppercase label used in each card header */
function QuestionLabel({ n }: { n: string }) {
  return (
    <span
      className="text-[10px] font-mono font-semibold tracking-widest uppercase"
      style={{ color: CRIMSON }}
    >
      QUESTION {n}
    </span>
  );
}

/** Muted "what to do" action line at the bottom of each card */
function ActionLine({ text }: { text: string }) {
  return (
    <p className="text-xs text-muted-foreground mt-3 pt-3 border-t border-border">
      <span className="font-mono font-semibold" style={{ color: CRIMSON }}>
        Action:{" "}
      </span>
      {text}
    </p>
  );
}

/** Empty state shown when a chart has no data */
function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex items-center justify-center h-40 text-muted-foreground text-sm font-mono">
      {message}
    </div>
  );
}

// ---------------------
// View 1: Agent Health Score Trends
// ---------------------
function TempTrendsView({ contacts }: { contacts: TempContact[] }) {
  if (contacts.length === 0) {
    return <EmptyState message="No contact data yet." />;
  }

  const sorted = [...contacts].sort((a, b) => b.health_score - a.health_score);
  const top5 = sorted.slice(0, 5);
  const bottom5 = sorted.slice(-5).reverse();

  const toChartRow = (c: TempContact) => ({
    name: `${c.first_name} ${c.last_name.charAt(0)}.`,
    health_score: c.health_score,
  });

  return (
    <div className="space-y-4">
      {/* Warming */}
      <div>
        <p className="text-[10px] uppercase tracking-widest font-mono text-muted-foreground mb-2">
          Warming up
        </p>
        {top5.length > 0 ? (
          <div style={{ width: "100%", height: 130 }}>
            <ResponsiveContainer>
              <BarChart
                data={top5.map(toChartRow)}
                layout="vertical"
                margin={{ top: 0, right: 32, left: 0, bottom: 0 }}
              >
                <XAxis
                  type="number"
                  domain={[0, 100]}
                  tick={CHART_STYLE}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  type="category"
                  dataKey="name"
                  width={80}
                  tick={{ ...CHART_STYLE, fill: "var(--text-secondary)" }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  contentStyle={{
                    background: "var(--surface-raised)",
                    border: "1px solid rgba(255,255,255,0.08)",
                    borderRadius: 8,
                    ...CHART_STYLE,
                    fontSize: 12,
                  }}
                  cursor={{ fill: "rgba(255,255,255,0.04)" }}
                  formatter={(v) => [`${v}`, "Health Score"]}
                />
                <Bar dataKey="health_score" radius={[0, 4, 4, 0]} barSize={16}>
                  {top5.map((_, i) => (
                    <Cell key={i} fill={SUCCESS} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <EmptyState message="Not enough contacts to rank." />
        )}
      </div>

      {/* Cooling */}
      <div>
        <p className="text-[10px] uppercase tracking-widest font-mono text-muted-foreground mb-2">
          Cooling off
        </p>
        {bottom5.length > 0 ? (
          <div style={{ width: "100%", height: 130 }}>
            <ResponsiveContainer>
              <BarChart
                data={bottom5.map(toChartRow)}
                layout="vertical"
                margin={{ top: 0, right: 32, left: 0, bottom: 0 }}
              >
                <XAxis
                  type="number"
                  domain={[0, 100]}
                  tick={CHART_STYLE}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  type="category"
                  dataKey="name"
                  width={80}
                  tick={{ ...CHART_STYLE, fill: "var(--text-secondary)" }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  contentStyle={{
                    background: "var(--surface-raised)",
                    border: "1px solid rgba(255,255,255,0.08)",
                    borderRadius: 8,
                    ...CHART_STYLE,
                    fontSize: 12,
                  }}
                  cursor={{ fill: "rgba(255,255,255,0.04)" }}
                  formatter={(v) => [`${v}`, "Health Score"]}
                />
                <Bar dataKey="health_score" radius={[0, 4, 4, 0]} barSize={16}>
                  {bottom5.map((_, i) => (
                    <Cell key={i} fill={CRIMSON} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <EmptyState message="Not enough contacts to rank." />
        )}
      </div>
    </div>
  );
}

// ---------------------
// View 2: Pipeline Funnel + Month-over-Month
// ---------------------
interface PipelineViewProps {
  stages: PipelineStageDatum[];
  closedThisMonth: number;
  closedLastMonth: number;
}

function PipelineView({
  stages,
  closedThisMonth,
  closedLastMonth,
}: PipelineViewProps) {
  const delta = closedLastMonth > 0
    ? ((closedThisMonth - closedLastMonth) / closedLastMonth) * 100
    : null;
  const isUp = closedThisMonth >= closedLastMonth;

  return (
    <div className="space-y-4">
      {/* Month-over-month stat */}
      <div className="flex items-start gap-6">
        <div>
          <p className="text-[10px] uppercase tracking-widest font-mono text-muted-foreground mb-1">
            Closed this month
          </p>
          <p className="text-2xl font-mono font-semibold text-foreground">
            {formatDollar(closedThisMonth)}
          </p>
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-widest font-mono text-muted-foreground mb-1">
            vs last month
          </p>
          <p
            className="text-2xl font-mono font-semibold"
            style={{ color: isUp ? SUCCESS : CRIMSON }}
          >
            {isUp ? "+" : ""}
            {delta !== null ? `${delta.toFixed(0)}%` : "--"}
          </p>
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-widest font-mono text-muted-foreground mb-1">
            Last month
          </p>
          <p className="text-2xl font-mono font-semibold text-muted-foreground">
            {formatDollar(closedLastMonth)}
          </p>
        </div>
      </div>

      {/* Stage funnel bars */}
      {stages.length > 0 ? (
        <div style={{ width: "100%", height: 160 }}>
          <ResponsiveContainer>
            <BarChart
              data={stages}
              margin={{ top: 0, right: 8, left: 0, bottom: 0 }}
            >
              <XAxis
                dataKey="stage"
                tick={{ ...CHART_STYLE, fill: "var(--text-secondary)" }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tick={CHART_STYLE}
                tickFormatter={formatDollar}
                axisLine={false}
                tickLine={false}
                width={48}
              />
              <Tooltip
                contentStyle={{
                  background: "var(--surface-raised)",
                  border: "1px solid rgba(255,255,255,0.08)",
                  borderRadius: 8,
                  ...CHART_STYLE,
                  fontSize: 12,
                }}
                cursor={{ fill: "rgba(255,255,255,0.04)" }}
                formatter={(value, _name, props) => {
                  const v = typeof value === "number" ? value : 0;
                  const count =
                    (props?.payload as PipelineStageDatum)?.count ?? 0;
                  return [
                    `${formatDollar(v)} -- ${count} deal${count !== 1 ? "s" : ""}`,
                    "Stage value",
                  ];
                }}
              />
              <Bar dataKey="value" radius={[4, 4, 0, 0]} barSize={36}>
                {stages.map((entry, i) => (
                  <Cell
                    key={i}
                    fill={entry.stage === "Closed" ? SUCCESS : SIGNAL_BLUE}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <EmptyState message="No opportunity data yet." />
      )}
    </div>
  );
}

// ---------------------
// View 3: Print Production Throughput
// ---------------------
interface ThroughputViewProps {
  weeks: ThroughputWeek[];
  avgTurnaround: number | null;
}

function ThroughputView({ weeks, avgTurnaround }: ThroughputViewProps) {
  const isOver = avgTurnaround !== null && avgTurnaround > 5;

  return (
    <div className="space-y-4">
      {/* Avg turnaround stat */}
      <div className="flex items-center gap-6">
        <div>
          <p className="text-[10px] uppercase tracking-widest font-mono text-muted-foreground mb-1">
            Avg turnaround
          </p>
          <p
            className="text-2xl font-mono font-semibold"
            style={{
              color:
                avgTurnaround === null
                  ? MUTED
                  : isOver
                  ? WARNING
                  : SUCCESS,
            }}
          >
            {avgTurnaround !== null ? `${avgTurnaround}d` : "--"}
          </p>
        </div>
        {isOver && (
          <p
            className="text-xs font-mono mt-4"
            style={{ color: WARNING }}
          >
            Over 5-day threshold
          </p>
        )}
      </div>

      {/* Stacked bars */}
      {weeks.length > 0 ? (
        <div style={{ width: "100%", height: 190 }}>
          <ResponsiveContainer>
            <BarChart
              data={weeks}
              margin={{ top: 0, right: 8, left: 0, bottom: 0 }}
            >
              <XAxis
                dataKey="week"
                tick={{ ...CHART_STYLE, fill: "var(--text-secondary)" }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tick={CHART_STYLE}
                allowDecimals={false}
                axisLine={false}
                tickLine={false}
                width={28}
              />
              <Tooltip
                contentStyle={{
                  background: "var(--surface-raised)",
                  border: "1px solid rgba(255,255,255,0.08)",
                  borderRadius: 8,
                  ...CHART_STYLE,
                  fontSize: 12,
                }}
                cursor={{ fill: "rgba(255,255,255,0.04)" }}
              />
              <Bar
                dataKey="submitted"
                name="Submitted"
                stackId="a"
                fill={SIGNAL_BLUE}
                radius={[0, 0, 0, 0]}
                barSize={28}
              />
              <Bar
                dataKey="completed"
                name="Completed"
                stackId="a"
                fill={SUCCESS}
                radius={[4, 4, 0, 0]}
                barSize={28}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <EmptyState message="No production data yet." />
      )}

      {/* Legend */}
      <div className="flex items-center gap-4 text-[10px] font-mono text-muted-foreground uppercase tracking-wider">
        <span className="flex items-center gap-1">
          <span
            className="inline-block w-3 h-3 rounded-sm"
            style={{ background: SIGNAL_BLUE }}
          />
          Submitted
        </span>
        <span className="flex items-center gap-1">
          <span
            className="inline-block w-3 h-3 rounded-sm"
            style={{ background: SUCCESS }}
          />
          Completed
        </span>
      </div>
    </div>
  );
}

// ---------------------
// View 4: Campaign Performance Table
// ---------------------
function CampaignTableView({ campaigns }: { campaigns: CampaignRow[] }) {
  if (campaigns.length === 0) {
    return <EmptyState message="No campaign data yet." />;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border">
            <th className="text-left py-2 pr-4 text-[10px] uppercase tracking-widest font-mono text-muted-foreground font-normal">
              Campaign
            </th>
            <th className="text-right py-2 pr-4 text-[10px] uppercase tracking-widest font-mono text-muted-foreground font-normal">
              Sent
            </th>
            <th className="text-right py-2 pr-4 text-[10px] uppercase tracking-widest font-mono text-muted-foreground font-normal">
              Open Rate
            </th>
            <th className="text-left py-2 text-[10px] uppercase tracking-widest font-mono text-muted-foreground font-normal">
              Status
            </th>
          </tr>
        </thead>
        <tbody>
          {campaigns.map((row) => (
            <tr
              key={row.id}
              className="border-b border-border/50 hover:bg-secondary/30 transition-colors"
            >
              <td className="py-2.5 pr-4 text-foreground font-medium max-w-[160px] truncate">
                {row.name}
              </td>
              <td className="py-2.5 pr-4 text-right font-mono text-foreground">
                {row.sent}
              </td>
              <td
                className="py-2.5 pr-4 text-right font-mono font-semibold"
                style={{ color: openRateColor(row.openRate) }}
              >
                {row.sent > 0 ? `${row.openRate.toFixed(0)}%` : "--"}
              </td>
              <td className="py-2.5">
                <span
                  className="text-[10px] uppercase tracking-wider font-mono px-2 py-0.5 rounded"
                  style={{
                    background:
                      row.status === "active"
                        ? "rgba(34,197,94,0.12)"
                        : row.status === "paused"
                        ? "rgba(234,179,8,0.12)"
                        : "rgba(255,255,255,0.06)",
                    color:
                      row.status === "active"
                        ? SUCCESS
                        : row.status === "paused"
                        ? WARNING
                        : MUTED,
                  }}
                >
                  {row.status}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ---------------------
// Main page
// ---------------------
export default function AnalyticsPage() {
  const supabase = createClient();

  // Q1: Health Score
  const [tempContacts, setTempContacts] = useState<TempContact[]>([]);

  // Q2: Pipeline
  const [pipelineStages, setPipelineStages] = useState<PipelineStageDatum[]>([]);
  const [closedThisMonth, setClosedThisMonth] = useState(0);
  const [closedLastMonth, setClosedLastMonth] = useState(0);

  // Q3: Throughput
  const [throughputWeeks, setThroughputWeeks] = useState<ThroughputWeek[]>([]);
  const [avgTurnaround, setAvgTurnaround] = useState<number | null>(null);

  // Q4: Campaigns
  const [campaignRows, setCampaignRows] = useState<CampaignRow[]>([]);

  const [loading, setLoading] = useState(true);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    const now = new Date();

    const [
      contactsRes,
      interactionsRecentRes,
      interactionsPriorRes,
      opportunitiesRes,
      materialsRes,
      campaignsRes,
      completionsRes,
    ] = await Promise.all([
      supabase
        .from("contacts")
        .select("id, first_name, last_name, health_score")
        .is("deleted_at", null),

      // Interactions in last 30 days (recent)
      supabase
        .from("interactions")
        .select("contact_id")
        .gte("occurred_at", subDays(now, 30).toISOString()),

      // Interactions 30-60 days ago (prior baseline)
      supabase
        .from("interactions")
        .select("contact_id")
        .gte("occurred_at", subDays(now, 60).toISOString())
        .lt("occurred_at", subDays(now, 30).toISOString()),

      supabase
        .from("opportunities")
        .select("stage, sale_price, closed_at")
        .not("stage", "eq", "fell_through"),

      supabase
        .from("material_requests")
        .select("status, created_at, submitted_at, completed_at")
        .is("deleted_at", null),

      supabase
        .from("campaigns")
        .select("id, name, status")
        .is("deleted_at", null),

      supabase
        .from("campaign_step_completions")
        .select(
          "enrollment_id, step_id, email_sent_at, email_opened, deleted_at"
        )
        .is("deleted_at", null),
    ]);

    // ------ Q1: Health Score contacts ------
    const contacts = contactsRes.data || [];
    const recentByContact = new Map<string, number>();
    const priorByContact = new Map<string, number>();

    (interactionsRecentRes.data || []).forEach((i) => {
      recentByContact.set(
        i.contact_id,
        (recentByContact.get(i.contact_id) || 0) + 1
      );
    });
    (interactionsPriorRes.data || []).forEach((i) => {
      priorByContact.set(
        i.contact_id,
        (priorByContact.get(i.contact_id) || 0) + 1
      );
    });

    const enriched: TempContact[] = contacts
      .filter((c) => typeof c.health_score === "number")
      .map((c) => ({
        id: c.id,
        first_name: c.first_name,
        last_name: c.last_name,
        health_score: c.health_score as number,
        recent_interactions: recentByContact.get(c.id) || 0,
        prior_interactions: priorByContact.get(c.id) || 0,
      }));

    setTempContacts(enriched);

    // ------ Q2: Pipeline ------
    const opps = opportunitiesRes.data || [];
    const stageOrder = [
      "prospect",
      "under_contract",
      "in_escrow",
      "closed",
    ];
    const stageLabels: Record<string, string> = {
      prospect: "Prospect",
      under_contract: "Under Contract",
      in_escrow: "In Escrow",
      closed: "Closed",
    };

    setPipelineStages(
      stageOrder.map((s) => {
        const matching = opps.filter((o) => o.stage === s);
        return {
          stage: stageLabels[s],
          value: matching.reduce((sum, o) => sum + (o.sale_price || 0), 0),
          count: matching.length,
        };
      })
    );

    const thisMonthStart = startOfMonth(now).toISOString();
    const thisMonthEnd = endOfMonth(now).toISOString();
    const lastMonthStart = startOfMonth(
      new Date(now.getFullYear(), now.getMonth() - 1, 1)
    ).toISOString();
    const lastMonthEnd = endOfMonth(
      new Date(now.getFullYear(), now.getMonth() - 1, 1)
    ).toISOString();

    const closedOpps = opps.filter((o) => o.stage === "closed" && o.closed_at);
    setClosedThisMonth(
      closedOpps
        .filter(
          (o) =>
            o.closed_at! >= thisMonthStart && o.closed_at! <= thisMonthEnd
        )
        .reduce((sum, o) => sum + (o.sale_price || 0), 0)
    );
    setClosedLastMonth(
      closedOpps
        .filter(
          (o) =>
            o.closed_at! >= lastMonthStart && o.closed_at! <= lastMonthEnd
        )
        .reduce((sum, o) => sum + (o.sale_price || 0), 0)
    );

    // ------ Q3: Throughput (last 8 weeks) ------
    const materials = materialsRes.data || [];
    const weekKeys: string[] = [];
    const weekMap = new Map<string, { submitted: number; completed: number }>();

    for (let i = 7; i >= 0; i--) {
      const weekStart = startOfWeek(subWeeks(now, i));
      const key = format(weekStart, "MMM d");
      weekKeys.push(key);
      weekMap.set(key, { submitted: 0, completed: 0 });
    }

    materials.forEach((m) => {
      const subKey = format(
        startOfWeek(new Date(m.created_at)),
        "MMM d"
      );
      if (weekMap.has(subKey)) {
        weekMap.get(subKey)!.submitted += 1;
      }
      if (m.status === "complete" && m.completed_at) {
        const compKey = format(
          startOfWeek(new Date(m.completed_at)),
          "MMM d"
        );
        if (weekMap.has(compKey)) {
          weekMap.get(compKey)!.completed += 1;
        }
      }
    });

    setThroughputWeeks(
      weekKeys.map((k) => ({
        week: k,
        submitted: weekMap.get(k)!.submitted,
        completed: weekMap.get(k)!.completed,
      }))
    );

    // Average turnaround
    const completedMaterials = materials.filter(
      (m) => m.status === "complete" && m.completed_at && m.submitted_at
    );
    if (completedMaterials.length > 0) {
      const turnarounds = completedMaterials.map((m) =>
        differenceInDays(new Date(m.completed_at!), new Date(m.submitted_at!))
      );
      setAvgTurnaround(
        Math.round(turnarounds.reduce((a, b) => a + b, 0) / turnarounds.length)
      );
    } else {
      setAvgTurnaround(null);
    }

    // ------ Q4: Campaign performance ------
    const campaigns = campaignsRes.data || [];
    const completions = completionsRes.data || [];

    const enrollmentsRes = await supabase
      .from("campaign_enrollments")
      .select("id, campaign_id")
      .is("deleted_at", null);

    const enrollments = enrollmentsRes.data || [];

    const enrollmentToCampaign = new Map<string, string>();
    enrollments.forEach((e) => {
      enrollmentToCampaign.set(e.id, e.campaign_id);
    });

    const campaignStats = new Map<
      string,
      { sent: number; opened: number }
    >();
    campaigns.forEach((c) => {
      campaignStats.set(c.id, { sent: 0, opened: 0 });
    });

    completions.forEach((comp) => {
      const campaignId = enrollmentToCampaign.get(comp.enrollment_id);
      if (!campaignId) return;
      const stats = campaignStats.get(campaignId);
      if (!stats) return;
      if (comp.email_sent_at) {
        stats.sent += 1;
        if (comp.email_opened) stats.opened += 1;
      }
    });

    const rows: CampaignRow[] = campaigns
      .map((c) => {
        const stats = campaignStats.get(c.id) || { sent: 0, opened: 0 };
        return {
          id: c.id,
          name: c.name,
          status: c.status,
          sent: stats.sent,
          opened: stats.opened,
          openRate: stats.sent > 0 ? (stats.opened / stats.sent) * 100 : 0,
        };
      })
      .sort((a, b) => b.openRate - a.openRate);

    setCampaignRows(rows);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  if (loading) {
    return (
      <SectionShell maxWidth="full" padY="none" className="px-0 sm:px-0 max-w-6xl mx-0">
        <PageHeader
          eyebrow="Friday review"
          title="Analytics"
          subhead={<span className="font-mono">Loading...</span>}
        />
        <AccentRule variant="hairline" className="mt-6 mb-6" />
      </SectionShell>
    );
  }

  const cardClass =
    "bg-card rounded-xl border border-border p-6 flex flex-col";

  return (
    <SectionShell maxWidth="full" padY="none" className="px-0 sm:px-0 max-w-6xl mx-0">
      <PageHeader
        eyebrow="Friday review"
        title="Analytics"
        subhead={
          <span className="font-mono">
            Four questions. Each answer is a decision.
          </span>
        }
      />
      <AccentRule variant="hairline" className="mt-6 mb-6" />

      {/* 2x2 grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Q1: Health Score Trends */}
        <div className={cardClass}>
          <div className="mb-4">
            <QuestionLabel n="01" />
            <h2 className="text-lg font-display font-semibold text-foreground mt-1">
              Which agents are warming up or cooling off?
            </h2>
          </div>
          <div className="flex-1">
            <TempTrendsView contacts={tempContacts} />
          </div>
          <ActionLine text="Call the top 5 cooling agents this week. Lock down the warmest 5 with a touch." />
        </div>

        {/* Q2: Pipeline */}
        <div className={cardClass}>
          <div className="mb-4">
            <QuestionLabel n="02" />
            <h2 className="text-lg font-display font-semibold text-foreground mt-1">
              What is moving through my pipeline and at what value?
            </h2>
          </div>
          <div className="flex-1">
            <PipelineView
              stages={pipelineStages}
              closedThisMonth={closedThisMonth}
              closedLastMonth={closedLastMonth}
            />
          </div>
          <ActionLine text="If this month is below last month, push the under_contract pile." />
        </div>

        {/* Q3: Print Production */}
        <div className={cardClass}>
          <div className="mb-4">
            <QuestionLabel n="03" />
            <h2 className="text-lg font-display font-semibold text-foreground mt-1">
              Is print production keeping pace with what agents need?
            </h2>
          </div>
          <div className="flex-1">
            <ThroughputView
              weeks={throughputWeeks}
              avgTurnaround={avgTurnaround}
            />
          </div>
          <ActionLine text="If turnaround creeps over 5 days, escalate to the design team." />
        </div>

        {/* Q4: Campaign Performance */}
        <div className={cardClass}>
          <div className="mb-4">
            <QuestionLabel n="04" />
            <h2 className="text-lg font-display font-semibold text-foreground mt-1">
              Which campaigns are actually generating opens and activity?
            </h2>
          </div>
          <div className="flex-1">
            <CampaignTableView campaigns={campaignRows} />
          </div>
          <ActionLine text="Repeat the top performer. Archive anything below 15 percent." />
        </div>

      </div>
    </SectionShell>
  );
}
