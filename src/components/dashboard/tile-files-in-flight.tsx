"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { FileClock } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { MonoNumeral } from "@/components/screen";

export function TileFilesInFlight() {
  const supabase = createClient();

  const query = useQuery<number>({
    queryKey: ["dashboard", "tile_files_in_flight"],
    queryFn: async () => {
      const { count } = await supabase
        .from("opportunities")
        .select("id", { count: "exact", head: true })
        .is("deleted_at", null)
        .in("stage", ["under_contract", "in_escrow"]);
      return count ?? 0;
    },
    staleTime: 60 * 1000,
  });

  const count = query.data ?? 0;

  return (
    <Link href="/opportunities" className="block group">
      <Card className="h-full transition-colors group-hover:bg-secondary/50">
        <CardContent className="p-4 flex flex-col gap-2">
          <div className="flex items-center gap-2 text-muted-foreground">
            <FileClock className="h-4 w-4" />
            <span className="text-[11px] font-mono uppercase tracking-wide">
              Files in flight
            </span>
          </div>
          <MonoNumeral size="xl" className="font-semibold text-foreground">
            {count}
          </MonoNumeral>
          <span className="text-[11px] font-mono text-muted-foreground">
            Under contract + in escrow
          </span>
        </CardContent>
      </Card>
    </Link>
  );
}
