// src/app/portal/[slug]/request/request-form.tsx
//
// Slice 7C Task 4b: client form for the portal marketing-request flow.
// Wires React's useFormState into the submitTicketAction server action
// declared on the page. The server action does the portal-session re-check
// before any write, so the slug is the binding key on submit.

"use client";

import { useFormState, useFormStatus } from "react-dom";
import type {
  RequestFormState,
  SubmitTicketAction,
} from "./submit-action";

const REQUEST_TYPES: { value: string; label: string }[] = [
  { value: "print_ready", label: "Print-ready (you have everything)" },
  { value: "design_help", label: "Needs design help" },
  { value: "template_request", label: "Template-based request" },
];

const PRODUCT_TYPES: { value: string; label: string }[] = [
  { value: "flyer", label: "Flyer" },
  { value: "brochure", label: "Brochure" },
  { value: "postcard", label: "Postcard" },
  { value: "door_hanger", label: "Door hanger" },
  { value: "eddm", label: "EDDM mailer" },
  { value: "other", label: "Other" },
];

const PRIORITIES: { value: string; label: string }[] = [
  { value: "standard", label: "Standard turnaround" },
  { value: "rush", label: "Rush" },
];

const initialState: RequestFormState = { status: "idle" };

export function RequestForm({
  action,
}: {
  action: SubmitTicketAction;
}) {
  const [state, formAction] = useFormState(action, initialState);

  if (state.status === "success") {
    return (
      <div className="rounded-lg border border-emerald-900/60 bg-emerald-950/30 px-6 py-8">
        <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-emerald-400">
          Request received
        </p>
        <h2 className="mt-2 font-display text-xl font-semibold tracking-tight text-zinc-100">
          Alex has it
        </h2>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-zinc-300">
          Your request landed in his production queue. Expect an update within
          one business day. Reference id below.
        </p>
        <p className="mt-4 font-mono text-[11px] text-zinc-500">
          Ticket {state.ticketId}
        </p>
      </div>
    );
  }

  return (
    <form action={formAction} className="space-y-6">
      <Field
        label="Project title"
        hint="Short headline. e.g., 'Just-listed flyer for 7402 E Cactus'."
      >
        <input
          name="title"
          type="text"
          required
          maxLength={200}
          className="w-full rounded-md border border-zinc-800 bg-zinc-950 px-4 py-3 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500"
          placeholder="Just-listed flyer"
        />
      </Field>

      <div className="grid gap-6 sm:grid-cols-2">
        <Field label="Product type">
          <Select name="product_type" defaultValue="flyer">
            {PRODUCT_TYPES.map((p) => (
              <option key={p.value} value={p.value}>
                {p.label}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Request type">
          <Select name="request_type" defaultValue="design_help">
            {REQUEST_TYPES.map((r) => (
              <option key={r.value} value={r.value}>
                {r.label}
              </option>
            ))}
          </Select>
        </Field>
      </div>

      <Field label="Priority">
        <Select name="priority" defaultValue="standard">
          {PRIORITIES.map((p) => (
            <option key={p.value} value={p.value}>
              {p.label}
            </option>
          ))}
        </Select>
      </Field>

      <Field
        label="Project notes"
        hint="Address, MLS, photos, copy, deadlines, anything else Alex needs."
      >
        <textarea
          name="notes"
          required
          maxLength={5000}
          rows={6}
          className="w-full rounded-md border border-zinc-800 bg-zinc-950 px-4 py-3 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500"
          placeholder="Listing details, target audience, anything specific you want included or avoided."
        />
      </Field>

      {state.status === "error" ? (
        <p className="rounded-md border border-red-900/60 bg-red-950/30 px-4 py-3 text-sm text-red-300">
          {state.message}
        </p>
      ) : null}

      <SubmitButton />
    </form>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block space-y-2">
      <span className="block font-mono text-[11px] uppercase tracking-[0.2em] text-zinc-500">
        {label}
      </span>
      {children}
      {hint ? <span className="block text-xs text-zinc-500">{hint}</span> : null}
    </label>
  );
}

function Select({
  name,
  defaultValue,
  children,
}: {
  name: string;
  defaultValue: string;
  children: React.ReactNode;
}) {
  return (
    <select
      name={name}
      defaultValue={defaultValue}
      className="w-full rounded-md border border-zinc-800 bg-zinc-950 px-4 py-3 text-sm text-zinc-100 focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500"
    >
      {children}
    </select>
  );
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex items-center justify-center rounded-md border border-zinc-100 bg-zinc-100 px-6 py-3 font-mono text-[12px] uppercase tracking-[0.2em] text-zinc-900 transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-60"
    >
      {pending ? "Submitting..." : "Submit request"}
    </button>
  );
}
