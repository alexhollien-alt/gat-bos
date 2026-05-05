"use client";

import { use } from "react";
import { SectionShell } from "@/components/screen";
import { TicketDetail } from "@/components/tickets/ticket-detail";

export default function TicketDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);

  return (
    <SectionShell>
      <TicketDetail id={id} />
    </SectionShell>
  );
}
