import { Interaction } from "@/lib/types";
import { INTERACTION_CONFIG } from "@/lib/constants";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MessageSquare } from "lucide-react";
import { format } from "date-fns";
import Link from "next/link";

export function RecentInteractionsWidget({
  interactions,
}: {
  interactions: Interaction[];
}) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium text-slate-600 flex items-center gap-2">
          <MessageSquare className="h-4 w-4" />
          Recent Activity
        </CardTitle>
      </CardHeader>
      <CardContent>
        {interactions.length === 0 ? (
          <p className="text-sm text-slate-400 py-2">No recent activity</p>
        ) : (
          <div className="space-y-2">
            {interactions.map((i) => (
              <Link
                key={i.id}
                href={`/contacts/${i.contact_id}`}
                className="block p-2 rounded-md hover:bg-slate-50 transition-colors"
              >
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="text-xs font-medium text-slate-500">
                    {INTERACTION_CONFIG[i.type]?.label}
                  </span>
                  {i.contacts && (
                    <span className="text-xs text-slate-400">
                      {i.contacts.first_name} {i.contacts.last_name}
                    </span>
                  )}
                </div>
                <p className="text-sm text-slate-700 line-clamp-1">
                  {i.summary}
                </p>
                <p className="text-xs text-slate-400 mt-0.5">
                  {format(new Date(i.occurred_at), "MMM d")}
                </p>
              </Link>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
