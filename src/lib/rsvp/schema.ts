import { z } from "zod";

export const rsvpSubmitSchema = z.object({
  slug: z.string().min(1).max(64),
  name: z.string().min(1).max(120).trim(),
  brokerage: z.string().min(1).max(120).trim(),
  email: z.string().email().max(200).trim(),
  phone: z
    .string()
    .max(40)
    .trim()
    .optional()
    .transform((v) => (v && v.length > 0 ? v : undefined)),
  guestCount: z.union([z.literal(1), z.literal(2)]).default(1),
  notes: z
    .string()
    .max(2000)
    .trim()
    .optional()
    .transform((v) => (v && v.length > 0 ? v : undefined)),
  // Honeypot field: bots fill, humans don't see it. Non-empty = drop.
  honeypot: z.string().max(200).optional(),
});

export type RsvpSubmitInput = z.infer<typeof rsvpSubmitSchema>;
