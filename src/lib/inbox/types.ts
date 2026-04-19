// src/lib/inbox/types.ts
import { z } from "zod";

export const InboxItemStatus = z.enum(["pending", "replied", "dismissed"]);

export const InboxItemRow = z.object({
  id: z.string().uuid(),
  user_id: z.string().uuid(),
  gmail_thread_id: z.string(),
  sender_email: z.string(),
  sender_name: z.string(),
  subject: z.string(),
  snippet: z.string(),
  received_at: z.string(),
  score: z.number().int().min(0).max(100),
  matched_rules: z.array(z.string()),
  contact_id: z.string().uuid().nullable(),
  contact_name: z.string().nullable(),
  contact_tier: z.string().nullable(),
  status: InboxItemStatus,
  dismissed_at: z.string().nullable(),
  created_at: z.string(),
});
export type InboxItem = z.infer<typeof InboxItemRow>;

export const InboxItemUpdate = z.object({
  status: InboxItemStatus,
});

export const ScanResult = z.object({
  scanned: z.number(),
  surfaced: z.number(),
  skipped: z.number(),
});
export type ScanResultT = z.infer<typeof ScanResult>;

export interface ThreadScore {
  score: number;
  matched_rules: string[];
  needs_reply: boolean;
}
