"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Sparkles } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { MonoNumeral } from "@/components/screen";

export function TileNewListings7d() {
  const supabase = createClient();

  const query = useQuery<number>({
    queryKey: ["dashboard", "tile_new_listings_7d"],
    queryFn: async () => {
      const sevenDaysAgo = new Date(
        Date.now() - 7 * 24 * 60 * 60 * 1000,
      ).toISOString();
      const { data } = await supabase
        .from("opportunities")
        .select("id, contacts!inner(tier)")
        .is("deleted_at", null)
        .gte("created_at", sevenDaysAgo)
        .in("contacts.tier", ["A", "B"]);
      return (data ?? []).length;
    },
    staleTime: 60 * 1000,
  });

  const count = query.data ?? 0;

  return (
    <Link href="/opportunities" className="block group">
      <Card className="h-full transition-colors group-hover:bg-secondary/50">
        <CardContent className="p-4 flex flex-col gap-2">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Sparkles className="h-4 w-4" />
            <span className="text-[11px] font-mono uppercase tracking-wide">
              New listings 7d
            </span>
          </div>
          <MonoNumeral size="xl" className="font-semibold text-foreground">
            {count}
          </MonoNumeral>
          <span className="text-[11px] font-mono text-muted-foreground">
            From Tier A + B agents
          </span>
        </CardContent>
      </Card>
    </Link>
  );
}
