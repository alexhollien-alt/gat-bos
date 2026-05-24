import { z } from "zod";

// Simplified RSVP submission: form collects Name + Guest count only.
// Email/brokerage/phone now sourced from a separate CSV upload, looked up
// server-side by name when sending the confirmation. Notes dropped to keep
// the form to a single decision.
export const rsvpSubmitSchema = z.object({
  slug: z.string().min(1).max(64),
  name: z.string().min(1).max(120).trim(),
  guestCount: z.union([z.literal(1), z.literal(2)]).default(1),
  // Honeypot field: bots fill, humans don't see it. Non-empty = drop.
  honeypot: z.string().max(200).optional(),
});

export type RsvpSubmitInput = z.infer<typeof rsvpSubmitSchema>;
