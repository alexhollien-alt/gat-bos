## LATER.md

Follow-ups deferred out of the current slice. Each entry: date logged, source slice, what to do, file/line(s) involved, why it was deferred. Promote to a real BLOCKERS.md entry only when it becomes blocking.

---

## Open

### [2026-04-26] (Slice 3B) Hard-drop `_deprecated_requests` after data confidence soak
- **Where:** `public._deprecated_requests` (renamed from `public.requests` in Slice 3B; 0 rows).
- **What:** After ~30 days of no regressions referencing the table, run `DROP TABLE public._deprecated_requests CASCADE;` to also drop the orphan inbound FK from `public.activities.request_id`. Confirm `activities.request_id` has no live writers first (it does not as of Slice 3B; the column itself is dead in current code).
- **Why deferred:** Standing Rule 3 prohibits hard deletes on first pass; soak period gives confidence the orphan really is orphan.

### [2026-04-26] (Slice 3B) Remove OAUTH_ENCRYPTION_KEY fallback in oauth.ts state signing
- **Where:** `src/lib/gmail/oauth.ts:getStateSigningKey()` -- helper currently does `process.env.OAUTH_STATE_SIGNING_KEY ?? requireEnv("OAUTH_ENCRYPTION_KEY")`.
- **What:** After ~7-14 days post-merge (one slice cycle, well past the 10-minute OAuth state TTL), drop the `?? requireEnv(...)` fallback so `OAUTH_STATE_SIGNING_KEY` is the only valid key for HMAC state signing. Encryption (`OAUTH_ENCRYPTION_KEY`) and signing then have fully separate keys.
- **Why deferred:** One-slice fallback ensures any in-flight OAuth state nonces (10-min TTL) signed with the old key still verify across the deploy boundary.

### [2026-04-26] (Slice 3B) Per-provider OAuth state-signing keys when non-Google providers arrive
- **Where:** `src/lib/gmail/oauth.ts` (currently a single combined Gmail+Calendar Google flow per `GMAIL_SCOPES` union at lines 13-17).
- **What:** When Outlook / Apple Calendar / any non-Google provider is added, introduce `OAUTH_STATE_SIGNING_KEY_<PROVIDER>` per-provider keys so a leaked signing key in one provider's flow doesn't cross-contaminate others.
- **Why deferred:** Today's single-key approach is correct for the single combined Google flow; per-provider split is premature without a second provider to contrast against.

### [2026-04-26] (Slice 3B) Migrate `@/components/materials/*` to `@/components/tickets/*`
- **Where:** `src/components/materials/material-request-row.tsx`, `src/components/materials/material-request-form.tsx` (and their import sites).
- **What:** Rename the directory + the two component files (`material-request-row.tsx` -> `ticket-row.tsx`, `material-request-form.tsx` -> `ticket-form.tsx`) and update all imports. Component naming drift is a source of future grep confusion now that the route is `/tickets` and the table is `tickets`.
- **Why deferred:** Slice 3B scope was DB + route + lib + OAuth; component naming was an explicit out-of-scope per starter to keep the diff focused.

### [2026-04-26] (Slice 3B) Rename `MaterialRequest*` types and identifiers to `Ticket*`
- **Where:** `src/app/(app)/tickets/[id]/actions.ts` (`MaterialRequestStatus` type alias), and any `MaterialRequest*` type/component identifiers across `src/`.
- **What:** Rename to `Ticket*` for consistency with the renamed table. Type rename is mechanical -- no behavior change.
- **Why deferred:** Out of scope per starter; bundling with the components/materials directory rename above would make a single clean follow-up slice.

### [2026-04-26] (Slice 3B) Rename `material_requests_contact_id_fkey` -> `tickets_contact_id_fkey` (cosmetic)
- **Where:** `public.tickets` constraint (still named `material_requests_contact_id_fkey` after the table rename; FK target `contacts.id`).
- **What:** `ALTER TABLE public.tickets RENAME CONSTRAINT material_requests_contact_id_fkey TO tickets_contact_id_fkey;`
- **Why deferred:** Decision-2 in Slice 3B scoped cosmetic renames to indexes + triggers + RLS policies, not FK constraint names. Cosmetic only -- the constraint works either way (regclass-based).

### [2026-04-26] (Slice 3B / Slice 4 follow-up) Migrate /api/inbox/scan to oauth_tokens-backed sync client
- **Where:** `src/app/api/inbox/scan/route.ts:47` (calls `fetchUnreadThreads` from `src/lib/gmail/client.ts`, which reads `process.env.GOOGLE_REFRESH_TOKEN`).
- **What:** Refactor scan route to use `loadTokens()` + `getOAuth2Client()` from `src/lib/gmail/oauth.ts` (already wired for the combined Gmail+Calendar scope), then remove `GOOGLE_REFRESH_TOKEN` from `.env.local` + Vercel envs + `.env.example`. New flow exists at `src/lib/gmail/sync-client.ts` reading from `oauth_tokens`; `client.ts` comment confirms it's "legacy still in use."
- **Why deferred:** One live caller exists, so removing the env var would break inbox sync. Scope creep for Slice 3B; cleaner as a dedicated Slice 4 task.

### [2026-04-26] (Slice 3A carryforward) Archive Slice 3A rate-limit-rpc paste-file
- **Where:** `~/Desktop/PASTE-INTO-SUPABASE-rate-limit-rpc.sql` (still on Desktop per BUILD.md Slice 3A note; smoke deferred until paste lands).
- **What:** Once Alex pastes the RPC and runs the live smoke (`pnpm dev` + 11x `/api/intake` POST to confirm 429), move the file to `~/Archive/paste-files/2026-04/` per Standing Rule 22.
- **Why deferred:** Out of Slice 3B scope; flagged in the Slice 3B risk register row #7.

---

## Done

(Items move here once executed, with date + closing commit/PR.)
