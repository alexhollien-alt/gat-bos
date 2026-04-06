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
  PieChart,
  Pie,
} from "recharts";
import { startOfWeek, format, subDays, differenceInDays } from "date-fns";

interface FunnelDatum {
  stage: string;
  count: number;
}

interface PipelineDatum {
  stage: string;
  value: number;
  count: number;
}

interface RelationshipDatum {
  name: string;
  value: number;
  color: string;
}

interface ThroughputDatum {
  week: string;
  count: number;
}

const FONT_STYLE = { fontFamily: "'Montserrat', sans-serif" };

const RELATIONSHIP_COLORS: Record<string, string> = {
  new: "#e8e8e8",
  warm: "#C6B79B",
  active_partner: "#003087",
  advocate: "#b31a35",
  dormant: "#666666",
};

function formatDollar(value: number): string {
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(0)}K`;
  return `$${value}`;
}

export default function AnalyticsPage() {
  const supabase = createClient();

  const [funnelData, setFunnelData] = useState<FunnelDatum[]>([]);
  const [pipelineData, setPipelineData] = useState<PipelineDatum[]>([]);
  const [relationshipData, setRelationshipData] = useState<RelationshipDatum[]>(
    []
  );
  const [throughputData, setThroughputData] = useState<ThroughputDatum[]>([]);
  const [avgTurnaround, setAvgTurnaround] = useState(0);
  const [loading, setLoading] = useState(true);

  const fetchAnalytics = useCallback(async () => {
    setLoading(true);

    const [contactsRes, opportunitiesRes, materialsRes, interactionsRes] =
      await Promise.all([
        supabase
          .from("contacts")
          .select("lead_status, relationship, tier, temperature, created_at")
          .is("deleted_at", null),
        supabase
          .from("opportunities")
          .select(
            "stage, sale_price, created_at, expected_close_date, closed_at"
          ),
        supabase
          .from("material_requests")
          .select("status, submitted_at, completed_at, created_at")
          .is("deleted_at", null),
        supabase
          .from("interactions")
          .select("contact_id, type, occurred_at")
          .gte("occurred_at", subDays(new Date(), 90).toISOString()),
      ]);

    const contacts = contactsRes.data || [];
    const opportunities = opportunitiesRes.data || [];
    const materials = materialsRes.data || [];
    // interactions fetched for future use (touch frequency)
    const _interactions = interactionsRes.data || [];

    // Widget 1: Agent Acquisition Funnel
    const funnelStages = [
      "prospect",
      "contacted",
      "qualified",
      "nurturing",
      "converted",
    ];
    setFunnelData(
      funnelStages.map((stage) => ({
        stage: stage.charAt(0).toUpperCase() + stage.slice(1),
        count: contacts.filter((c) => c.lead_status === stage).length,
      }))
    );

    // Widget 2: Pipeline Health
    const pipelineStages = [
      "prospect",
      "under_contract",
      "in_escrow",
      "closed",
    ];
    setPipelineData(
      pipelineStages.map((stage) => ({
        stage: stage
          .replace("_", " ")
          .replace(/\b\w/g, (l) => l.toUpperCase()),
        value: opportunities
          .filter((o) => o.stage === stage)
          .reduce((sum, o) => sum + (o.sale_price || 0), 0),
        count: opportunities.filter((o) => o.stage === stage).length,
      }))
    );

    // Widget 3: Relationship Breakdown
    const relationshipKeys = [
      "new",
      "warm",
      "active_partner",
      "advocate",
      "dormant",
    ];
    setRelationshipData(
      relationshipKeys
        .map((rel) => ({
          name: rel
            .replace("_", " ")
            .replace(/\b\w/g, (l) => l.toUpperCase()),
          value: contacts.filter((c) => c.relationship === rel).length,
          color: RELATIONSHIP_COLORS[rel],
        }))
        .filter((d) => d.value > 0)
    );

    // Widget 4: Production Throughput
    const completedMaterials = materials.filter(
      (m) => m.status === "complete" && m.completed_at
    );
    const weekMap = new Map<string, number>();
    completedMaterials.forEach((m) => {
      const week = format(
        startOfWeek(new Date(m.completed_at!)),
        "MMM d"
      );
      weekMap.set(week, (weekMap.get(week) || 0) + 1);
    });
    setThroughputData(
      Array.from(weekMap.entries()).map(([week, count]) => ({ week, count }))
    );

    // Average turnaround
    const turnarounds = completedMaterials
      .filter((m) => m.submitted_at)
      .map((m) =>
        differenceInDays(
          new Date(m.completed_at!),
          new Date(m.submitted_at!)
        )
      );
    setAvgTurnaround(
      turnarounds.length > 0
        ? Math.round(turnarounds.reduce((a, b) => a + b, 0) / turnarounds.length)
        : 0
    );

    setLoading(false);
  }, []);

  useEffect(() => {
    fetchAnalytics();
  }, [fetchAnalytics]);

  if (loading) {
    return (
      <div className="max-w-6xl">
        <div className="mb-6">
          <h1 className="text-xl font-semibold text-slate-800">Analytics</h1>
          <p className="text-sm text-slate-400 mt-0.5">Loading data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl">
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-slate-800">Analytics</h1>
        <p className="text-sm text-slate-400 mt-0.5">
          Pipeline, relationships, and production at a glance
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Widget 1: Agent Acquisition Funnel */}
        <div className="bg-white rounded-xl border border-[#e8e8e8] p-6 shadow-sm">
          <p className="text-[11px] uppercase tracking-wider text-[#b31a35] font-semibold mb-1">
            Lead Pipeline
          </p>
          <p className="text-[20px] font-semibold text-[#0a0a0a] mb-4">
            Agent Acquisition Funnel
          </p>
          <div style={{ width: "100%", height: 250 }}>
            <ResponsiveContainer>
              <BarChart
                data={funnelData}
                layout="vertical"
                margin={{ top: 0, right: 30, left: 0, bottom: 0 }}
              >
                <XAxis type="number" style={FONT_STYLE} tick={{ fontSize: 11 }} />
                <YAxis
                  type="category"
                  dataKey="stage"
                  width={90}
                  style={FONT_STYLE}
                  tick={{ fontSize: 12 }}
                />
                <Tooltip
                  contentStyle={{ ...FONT_STYLE, fontSize: 12 }}
                  formatter={(value) => [`${value}`, "Contacts"]}
                />
                <Bar dataKey="count" fill="#b31a35" radius={[0, 4, 4, 0]} barSize={24} label={{ position: "right", style: { ...FONT_STYLE, fontSize: 11, fill: "#0a0a0a" } }} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Widget 2: Pipeline Health */}
        <div className="bg-white rounded-xl border border-[#e8e8e8] p-6 shadow-sm">
          <p className="text-[11px] uppercase tracking-wider text-[#003087] font-semibold mb-1">
            Revenue
          </p>
          <p className="text-[20px] font-semibold text-[#0a0a0a] mb-4">
            Pipeline Health
          </p>
          <div style={{ width: "100%", height: 250 }}>
            <ResponsiveContainer>
              <BarChart
                data={pipelineData}
                margin={{ top: 0, right: 10, left: 10, bottom: 0 }}
              >
                <XAxis
                  dataKey="stage"
                  style={FONT_STYLE}
                  tick={{ fontSize: 11 }}
                />
                <YAxis
                  style={FONT_STYLE}
                  tick={{ fontSize: 11 }}
                  tickFormatter={formatDollar}
                />
                <Tooltip
                  contentStyle={{ ...FONT_STYLE, fontSize: 12 }}
                  formatter={(value, _name, props) => {
                    const v = typeof value === "number" ? value : 0;
                    const count = (props?.payload as PipelineDatum)?.count ?? 0;
                    return [`${formatDollar(v)} (${count} deals)`, "Value"];
                  }}
                />
                <Bar dataKey="value" radius={[4, 4, 0, 0]} barSize={40}>
                  {pipelineData.map((entry, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={entry.stage === "Closed" ? "#b31a35" : "#003087"}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Widget 3: Relationship Breakdown */}
        <div className="bg-white rounded-xl border border-[#e8e8e8] p-6 shadow-sm">
          <p className="text-[11px] uppercase tracking-wider text-[#b31a35] font-semibold mb-1">
            Contacts
          </p>
          <p className="text-[20px] font-semibold text-[#0a0a0a] mb-4">
            Relationship Breakdown
          </p>
          <div style={{ width: "100%", height: 250 }}>
            <ResponsiveContainer>
              <PieChart>
                <Pie
                  data={relationshipData}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  outerRadius={90}
                  innerRadius={50}
                  paddingAngle={2}
                  label={({ name, value }) =>
                    `${name ?? ""} (${value ?? 0})`
                  }
                  style={{ ...FONT_STYLE, fontSize: 11 }}
                >
                  {relationshipData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{ ...FONT_STYLE, fontSize: 12 }}
                  formatter={(value) => [`${value}`, "Contacts"]}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Widget 4: Production Throughput */}
        <div className="bg-white rounded-xl border border-[#e8e8e8] p-6 shadow-sm">
          <p className="text-[11px] uppercase tracking-wider text-[#003087] font-semibold mb-1">
            Materials
          </p>
          <p className="text-[20px] font-semibold text-[#0a0a0a] mb-1">
            Production Throughput
          </p>
          <p className="text-xs text-[#666666] mb-4">
            Last 90 days{avgTurnaround > 0 ? ` -- avg turnaround: ${avgTurnaround} day${avgTurnaround !== 1 ? "s" : ""}` : ""}
          </p>
          <div style={{ width: "100%", height: 250 }}>
            <ResponsiveContainer>
              <BarChart
                data={throughputData}
                margin={{ top: 0, right: 10, left: 0, bottom: 0 }}
              >
                <XAxis
                  dataKey="week"
                  style={FONT_STYLE}
                  tick={{ fontSize: 11 }}
                />
                <YAxis
                  style={FONT_STYLE}
                  tick={{ fontSize: 11 }}
                  allowDecimals={false}
                />
                <Tooltip
                  contentStyle={{ ...FONT_STYLE, fontSize: 12 }}
                  formatter={(value) => [`${value}`, "Completed"]}
                />
                <Bar dataKey="count" fill="#003087" radius={[4, 4, 0, 0]} barSize={28} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}
