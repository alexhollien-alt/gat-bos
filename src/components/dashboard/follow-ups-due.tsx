"use client";

import { FollowUp } from "@/lib/types";
import { FollowUpRow } from "@/components/follow-ups/follow-up-list";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Clock } from "lucide-react";

export function FollowUpsDueWidget({
  followUps,
  onUpdate,
}: {
  followUps: FollowUp[];
  onUpdate: () => void;
}) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium text-slate-600 flex items-center gap-2">
          <Clock className="h-4 w-4" />
          Follow-ups Due
          {followUps.length > 0 && (
            <span className="bg-red-100 text-red-700 text-xs px-1.5 py-0.5 rounded-full">
              {followUps.length}
            </span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {followUps.length === 0 ? (
          <p className="text-sm text-slate-400 py-2">All caught up</p>
        ) : (
          followUps.slice(0, 5).map((fu) => (
            <FollowUpRow key={fu.id} followUp={fu} onUpdate={onUpdate} />
          ))
        )}
      </CardContent>
    </Card>
  );
}
