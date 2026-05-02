// src/app/portal/[slug]/request/submit-action.ts
//
// Slice 7C Task 4b: types + Zod schema for the portal request submit action.
//
// The actual server action is defined inline inside page.tsx (as a closure
// over the slug param) because Next.js requires every export from a
// "use server" module to be an async function -- a factory that returns a
// server action does not satisfy that rule. The page imports these types
// and the schema, then declares the action with "use server" at the
// function level.

import { z } from "zod";

export type RequestFormState =
  | { status: "idle" }
  | { status: "success"; ticketId: string }
  | { status: "error"; message: string };

export type SubmitTicketAction = (
  prevState: RequestFormState,
  formData: FormData,
) => Promise<RequestFormState>;

export const submitRequestSchema = z.object({
  title: z.string().trim().min(1).max(200),
  notes: z.string().trim().min(1).max(5000),
  request_type: z.enum(["print_ready", "design_help", "template_request"]),
  product_type: z.enum([
    "flyer",
    "brochure",
    "postcard",
    "door_hanger",
    "eddm",
    "other",
  ]),
  priority: z.enum(["standard", "rush"]),
});
