"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Megaphone } from "lucide-react";
import Link from "next/link";
import {
  AreaChart,
  Area,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { subDays, format, startOfDay } from "date-fns";
import { MonoNumeral } from "@/components/screen";

interface DailyActivity {
  day: string;
  sent: number;
}

interface SummaryStats {
  activeCampaigns: number;
  sent30d: number;
  openRate: number;
}

const ACCENT = "var(--accent-red)";

export function CampaignTimelineWidget() {
  const supabase = createClient();

  const [stats, setStats] = useState<SummaryStats>({
    activeCampaigns: 0,
    sent30d: 0,
    openRate: 0,
  });
  const [chartData, setChartData] = useState<DailyActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasActivity, setHasActivity] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);

    const thirtyDaysAgo = subDays(new Date(), 30).toISOString();

    const [campaignsRes, completionsRes] = await Promise.all([
      supabase
        .from("campaigns")
        .select("id, status")
        .is("deleted_at", null),
      supabase
        .from("campaign_step_completions")
        .select("email_sent_at, email_delivered, email_opened")
        .not("email_sent_at", "is", null)
        .gte("email_sent_at", thirtyDaysAgo),
    ]);

    const campaigns = campaignsRes.data || [];
    const completions = completionsRes.data || [];

    // Active campaign count
    const activeCampaigns = campaigns.filter((c) => c.status === "active").length;

    // Sent and open rate
    const sent30d = completions.length;
    const delivered = completions.filter((c) => c.email_delivered).length;
    const opened = completions.filter((c) => c.email_opened).length;
    const openRate = delivered > 0 ? Math.round((opened / delivered) * 100) : 0;

    setStats({ activeCampaigns, sent30d, openRate });
    setHasActivity(campaigns.length > 0 || sent30d > 0);

    // Build daily chart data for the last 30 days
    const dayMap = new Map<string, number>();
    for (let i = 29; i >= 0; i--) {
      const day = format(startOfDay(subDays(new Date(), i)), "MMM d");
      dayMap.set(day, 0);
    }

    completions.forEach((c) => {
      if (!c.email_sent_at) return;
      const day = format(startOfDay(new Date(c.email_sent_at)), "MMM d");
      if (dayMap.has(day)) {
        dayMap.set(day, (dayMap.get(day) ?? 0) + 1);
      }
    });

    setChartData(
      Array.from(dayMap.entries()).map(([day, sent]) => ({ day, sent }))
    );

    setLoading(false);
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  if (loading) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
            <Megaphone className="h-4 w-4" />
            Campaign Activity
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-muted-foreground">Loading...</p>
        </CardContent>
      </Card>
    );
  }

  if (!hasActivity) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
            <Megaphone className="h-4 w-4" />
            Campaign Activity
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-6 gap-2 text-muted-foreground">
            <Megaphone className="h-8 w-8 opacity-30" />
            <p className="text-sm">No campaign activity yet</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
          <Megaphone className="h-4 w-4" />
          Campaign Activity
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Summary stats */}
        <div className="grid grid-cols-3 gap-2">
          <div className="flex flex-col gap-0.5">
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
              Active
            </span>
            <MonoNumeral size="md" className="font-semibold text-foreground">
              {stats.activeCampaigns}
            </MonoNumeral>
          </div>
          <div className="flex flex-col gap-0.5">
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
              Sent (30d)
            </span>
            <MonoNumeral size="md" className="font-semibold text-foreground">
              {stats.sent30d}
            </MonoNumeral>
          </div>
          <div className="flex flex-col gap-0.5">
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
              Open rate
            </span>
            <span className="leading-tight">
              <MonoNumeral size="md" className="font-semibold text-foreground">
                {stats.openRate}
              </MonoNumeral>
              <span className="text-sm font-mono text-muted-foreground">%</span>
            </span>
          </div>
        </div>

        {/* Area chart -- emails sent per day, last 30 days */}
        <div style={{ width: "100%", height: 80 }}>
          <ResponsiveContainer>
            <AreaChart
              data={chartData}
              margin={{ top: 4, right: 0, left: 0, bottom: 0 }}
            >
              <defs>
                <linearGradient id="campaignFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={ACCENT} stopOpacity={0.18} />
                  <stop offset="95%" stopColor={ACCENT} stopOpacity={0} />
                </linearGradient>
              </defs>
              <Tooltip
                contentStyle={{
                  backgroundColor: "var(--card)",
                  border: "1px solid var(--border)",
                  borderRadius: 6,
                  fontSize: 11,
                  fontFamily: "var(--font-mono)",
                  color: "var(--foreground)",
                  padding: "4px 8px",
                }}
                itemStyle={{ color: ACCENT }}
                labelStyle={{ color: "var(--muted-foreground)", fontSize: 10 }}
                formatter={(value) => [value, "sent"]}
              />
              <Area
                type="monotone"
                dataKey="sent"
                stroke={ACCENT}
                strokeWidth={1.5}
                fill="url(#campaignFill)"
                dot={false}
                activeDot={{ r: 3, fill: ACCENT, stroke: "var(--card)", strokeWidth: 2 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Footer link */}
        <div className="pt-1 border-t border-border">
          <Link
            href="/campaigns"
            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            View all campaigns →
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}
