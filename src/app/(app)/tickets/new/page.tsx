"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { PageHeader, AccentRule, SectionShell } from "@/components/screen";
import { TicketForm } from "@/components/tickets/ticket-form";
import type { TicketCreateFormData } from "@/lib/schemas/ticket";
import { ArrowLeft } from "lucide-react";

export default function NewTicketPage() {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(data: TicketCreateFormData, asDraft = false) {
    setSubmitting(true);
    const body = asDraft ? { ...data, status: "draft" } : { ...data, status: "submitted" };

    const res = await fetch("/api/tickets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    setSubmitting(false);

    if (!res.ok) {
      const json = await res.json().catch(() => ({}));
      if (json.issues) {
        toast.error(`Validation error: ${json.issues[0]?.message ?? "Check the form"}`);
      } else {
        toast.error("Failed to create ticket. Please try again.");
      }
      return;
    }

    const { ticket } = await res.json();
    toast.success(asDraft ? "Draft saved" : "Ticket submitted");
    router.push(`/tickets/${ticket.id}`);
  }

  return (
    <SectionShell maxWidth="container-narrow">
      <div className="mb-6">
        <Button asChild variant="ghost" size="sm" className="-ml-2 mb-4">
          <Link href="/tickets">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Tickets
          </Link>
        </Button>
        <PageHeader
          title="New Ticket"
          subhead="Create a new Cypher design request."
        />
      </div>
      <AccentRule className="mb-8" />
      <TicketForm
        onSubmit={handleSubmit}
        submitting={submitting}
        submitLabel="Submit Ticket"
      />
    </SectionShell>
  );
}
