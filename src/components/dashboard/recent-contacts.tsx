import { Contact } from "@/lib/types";
import { RelationshipBadge } from "@/components/relationship-badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users } from "lucide-react";
import Link from "next/link";

export function RecentContactsWidget({
  contacts,
}: {
  contacts: Contact[];
}) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium text-slate-600 flex items-center gap-2">
          <Users className="h-4 w-4" />
          Recently Added
        </CardTitle>
      </CardHeader>
      <CardContent>
        {contacts.length === 0 ? (
          <p className="text-sm text-slate-400 py-2">No contacts yet</p>
        ) : (
          <div className="space-y-2">
            {contacts.map((c) => (
              <Link
                key={c.id}
                href={`/contacts/${c.id}`}
                className="flex items-center justify-between p-2 rounded-md hover:bg-slate-50 transition-colors"
              >
                <div>
                  <p className="text-sm font-medium text-slate-700">
                    {c.first_name} {c.last_name}
                  </p>
                  <p className="text-xs text-slate-400">
                    {c.company || "No company"}
                  </p>
                </div>
                <RelationshipBadge relationship={c.relationship} />
              </Link>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
