// src/app/portal/[slug]/request/page.tsx
//
// Slice 7C Task 4b: agent partner portal request form.
//
// The [slug] layout has already validated the portal session, so reaching
// this page guarantees a slug-bound agent. We re-call requirePortalSession
// to surface the typed agent record for header rendering. The submit path
// re-validates the session inside the server action (slug stays the binding
// key on the write).
//
// The server action is declared inline so it can close over the slug param
// without breaking Next's "use server" export rule (every export from a
// module-level "use server" file must itself be an async function).
//
// Submitting writes one tickets row + one ticket_items row via adminClient
// with source='portal'. The agent's contact_id is stamped from the session,
// not from the form payload, so a malicious payload cannot impersonate
// another agent.

import type { Metadata } from "next";
import { adminClient } from "@/lib/supabase/admin";
import { requirePortalSession } from "@/lib/auth/requirePortalSession";
import { RequestForm } from "./request-form";
import {
  submitRequestSchema,
  type RequestFormState,
} from "./submit-action";

export const metadata: Metadata = {
  title: "Submit a request - Partner Portal",
};

export default async function PortalRequestPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const { agent } = await requirePortalSession(slug);

  async function submitTicketAction(
    _prevState: RequestFormState,
    formData: FormData,
  ): Promise<RequestFormState> {
    "use server";

    const parsed = submitRequestSchema.safeParse({
      title: formData.get("title"),
      notes: formData.get("notes"),
      request_type: formData.get("request_type"),
      product_type: formData.get("product_type"),
      priority: formData.get("priority"),
    });
    if (!parsed.success) {
      return {
        status: "error",
        message:
          "One or more fields look invalid. Check the title, notes, and selections, then try again.",
      };
    }

    let sessionAgent;
    try {
      ({ agent: sessionAgent } = await requirePortalSession(slug));
    } catch {
      return {
        status: "error",
        message:
          "Your portal session is no longer valid. Reload this page and sign in again.",
      };
    }

    const { data: account, error: accountError } = await adminClient
      .from("accounts")
      .select("owner_user_id")
      .is("deleted_at", null)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    if (accountError || !account?.owner_user_id) {
      console.error("portal request: no account owner resolvable", accountError);
      return {
        status: "error",
        message:
          "We could not route your request. Please text Alex at (480) 204-2983.",
      };
    }

    const submitterName =
      `${sessionAgent.first_name} ${sessionAgent.last_name}`.trim();

    const { data: ticket, error: ticketError } = await adminClient
      .from("tickets")
      .insert({
        title: parsed.data.title,
        notes: parsed.data.notes,
        request_type: parsed.data.request_type,
        priority: parsed.data.priority,
        status: "submitted",
        source: "portal",
        user_id: account.owner_user_id,
        contact_id: sessionAgent.id,
        submitter_name: submitterName,
        submitter_email: sessionAgent.email,
        submitter_phone: sessionAgent.phone,
        submitted_at: new Date().toISOString(),
      })
      .select("id")
      .single();

    if (ticketError || !ticket) {
      console.error("portal request: ticket insert failed", ticketError);
      return {
        status: "error",
        message:
          "Something went wrong saving your request. Please try again or text Alex at (480) 204-2983.",
      };
    }

    const { error: itemError } = await adminClient.from("ticket_items").insert({
      request_id: ticket.id,
      product_type: parsed.data.product_type,
      quantity: 1,
      description: parsed.data.notes,
    });

    if (itemError) {
      console.error(
        "portal request: ticket_items insert failed (ticket already saved)",
        itemError,
      );
    }

    return { status: "success", ticketId: ticket.id };
  }

  const fullName = `${agent.first_name} ${agent.last_name}`.trim();

  return (
    <div className="space-y-10">
      <header className="space-y-3">
        <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-zinc-500">
          Marketing request
        </p>
        <h1 className="font-display text-3xl font-semibold tracking-tight text-zinc-100 sm:text-4xl">
          Brief Alex on a project
        </h1>
        <p className="max-w-2xl text-base leading-relaxed text-zinc-400">
          Submitting from {fullName}
          {agent.brokerage ? ` at ${agent.brokerage}` : ""}. Requests route
          directly into Alex&apos;s production queue.
        </p>
      </header>

      <section className="rounded-lg border border-zinc-800 bg-zinc-900/40 px-6 py-8 sm:px-8">
        <RequestForm action={submitTicketAction} />
      </section>

      <aside className="rounded-lg border border-zinc-800 bg-zinc-900/30 px-6 py-6">
        <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-zinc-500">
          What happens next
        </p>
        <ul className="mt-3 space-y-2 text-sm leading-relaxed text-zinc-400">
          <li>
            Alex reviews every request himself and replies within one business
            day.
          </li>
          <li>
            Rush requests jump the queue. Standard turnaround is two to three
            business days for first proofs.
          </li>
          <li>
            Need to attach photos or a long brief? Reference the ticket id in a
            text or email and Alex will pair the file to your request.
          </li>
        </ul>
      </aside>
    </div>
  );
}
