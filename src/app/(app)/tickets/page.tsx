import { Suspense } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { PageHeader, AccentRule, SectionShell } from "@/components/screen";
import { TicketList } from "@/components/tickets/ticket-list";
import { Plus } from "lucide-react";

export const metadata = {
  title: "Tickets -- GAT-BOS",
};

export default function TicketsPage() {
  return (
    <SectionShell>
      <div className="flex items-end justify-between gap-4 mb-2">
        <div>
          <PageHeader
            title="Tickets"
            subhead="Cypher Bridge -- manage and track design requests."
          />
        </div>
        <Button asChild size="sm" className="shrink-0 gap-2">
          <Link href="/tickets/new">
            <Plus className="h-4 w-4" />
            New Ticket
          </Link>
        </Button>
      </div>
      <AccentRule className="mb-6" />
      <Suspense fallback={<div className="py-12 text-center text-muted-foreground text-sm">Loading...</div>}>
        <TicketList />
      </Suspense>
    </SectionShell>
  );
}
