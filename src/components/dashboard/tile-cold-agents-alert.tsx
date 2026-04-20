"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { MonoNumeral } from "@/components/screen";

const COLD_THRESHOLD_DAYS = 21;

export function TileColdAgentsAlert() {
  const supabase = createClient();

  const query = useQuery<number>({
    queryKey: ["dashboard", "tile_cold_agents_21d"],
    queryFn: async () => {
      const cutoff = new Date(
        Date.now() - COLD_THRESHOLD_DAYS * 24 * 60 * 60 * 1000,
      ).toISOString();
      const { count } = await supabase
        .from("contacts")
        .select("id", { count: "exact", head: true })
        .is("deleted_at", null)
        .eq("tier", "A")
        .or(`last_touchpoint.is.null,last_touchpoint.lt.${cutoff}`);
      return count ?? 0;
    },
    staleTime: 60 * 1000,
  });

  const count = query.data ?? 0;
  const hasAlert = count > 0;

  return (
    <Link href="/contacts?tier=A" className="block group">
      <Card className="h-full transition-colors group-hover:bg-secondary/50">
        <CardContent className="p-4 flex flex-col gap-2">
          <div
            className="flex items-center gap-2"
            style={{
              color: hasAlert ? "var(--brand-red)" : "var(--text-muted)",
            }}
          >
            <AlertTriangle className="h-4 w-4" />
            <span className="text-[11px] font-mono uppercase tracking-wide">
              Cold Tier A agents
            </span>
          </div>
          <MonoNumeral
            size="xl"
            className="font-semibold text-foreground"
            style={hasAlert ? { color: "var(--brand-red)" } : undefined}
          >
            {count}
          </MonoNumeral>
          <span className="text-[11px] font-mono text-muted-foreground">
            No touch in {COLD_THRESHOLD_DAYS}+ days
          </span>
        </CardContent>
      </Card>
    </Link>
  );
}
