# GAT-BOS Capture -- Manual Setup (Gate 2 closeout)

This document is the manual checklist Alex follows on claude.ai to wire up conversational capture. Everything below is operator action. Claude Code's job ended at the previous commit; this is the human-in-the-loop step.

Estimated time: 20 minutes including a 5-minute test conversation.

> **Phase 0 scope: laptop only.** Conversational capture in Phase 0 runs through a local MCP server on this laptop talking to a local `pnpm dev` running `/api/captures`. Mobile capture (a hosted MCP server reachable from Claude on iOS, or any other off-laptop path) is a **Phase 1 deliverable** and is not in scope here. Do not rely on this for capture-from-anywhere yet.

> **Blocked on the MCP server build.** The manual checklist below cannot complete until the local MCP server exists. The MCP server holds `INTERNAL_API_TOKEN` and forwards `capture_to_task_system` tool calls from the Claude Project on claude.ai to `http://localhost:<port>/api/captures`. The MCP server is its own piece of work, decided in a separate scoping session before Gate 3 starts. See `BLOCKERS.md` for the open entry.

---

## What you need before you start

1. **The Claude Project tool spec.** Lives at `src/lib/claude-tools/capture-tool.ts`. The `captureTool` constant in that file is the canonical Anthropic function-calling schema.
2. **The Claude Project system prompt.** Lives at `docs/task-system/claude-project-prompt.md`. Copy-paste verbatim into the Claude Project system prompt field on claude.ai.
3. **The capture endpoint URL.** For Phase 0 local testing this is `http://localhost:3002/api/captures` (or whatever port `pnpm dev` landed on; check `pnpm dev` output). For production this will be `https://gat-bos.vercel.app/api/captures` once you deploy the `task-system-phase-0` branch (not yet pushed; local-first per your standing instruction).
4. **The bearer auth secret.** `INTERNAL_API_TOKEN` from `~/crm/.env.local`. Grab it with: `grep '^INTERNAL_API_TOKEN=' ~/crm/.env.local`. **Do not paste this value into the Claude Project itself; it lives on the proxy or MCP server in front of the API.** See the wiring section below.
5. **Your operator user_id.** `OWNER_USER_ID` from `~/crm/.env.local`. Already set to `b735d691-4d86-4e31-9fd3-c2257822dca3`. This is what the bearer-auth path resolves to. The brief mentioned `GAT_OPERATOR_USER_ID`; the actual env var the route reads is `OWNER_USER_ID` (matches the existing `/api/intake` pattern). No renaming needed.

---

## Wiring: how the Claude Project actually reaches `/api/captures`

The Claude Project on claude.ai cannot directly call a private API that requires a bearer secret. Claude itself only knows the tool's JSON schema; the actual HTTP call happens in one of two places, and you pick which:

### Option A -- MCP server (recommended, longer setup)

Stand up a tiny MCP server that registers the `capture_to_task_system` tool. The MCP server holds `INTERNAL_API_TOKEN` in its own environment and forwards each tool invocation to your capture endpoint. The Claude Project on claude.ai connects to the MCP server via the connectors panel.

Pros: persistent connection, no per-call configuration, secret never leaves your machine / Vercel project.

Cons: more setup. Two paths:

- **Local MCP** -- Run the MCP server on your laptop via `uv` or `npx`. Good for Phase 0 testing while the endpoint is still on `localhost:3002`. Survives Claude Code session restarts. Stops when laptop sleeps.
- **Hosted MCP** -- Deploy the MCP server as a separate Vercel project (or a Cloudflare Worker). Required once the endpoint is on Vercel and you want the conversational capture to work from your phone.

### Option B -- Webhook proxy (faster setup, slightly less elegant)

Use Anthropic's built-in tool support inside the Claude Project on claude.ai. The tool's "handler" field points at a public webhook URL (e.g. `https://gat-bos.vercel.app/api/capture-webhook`). The webhook handler reads the bearer secret from Vercel env, forwards the call to `/api/captures` with `target: "task_system"` and `source: "claude"` injected, returns the response.

Pros: faster to set up, no second deploy.

Cons: requires a public webhook endpoint exposed, even though it just proxies. Adds one network hop.

**For Phase 0 / Gate 2, recommend Option A with the local MCP variant.** It keeps the secret on your laptop, lets you test against `localhost:3002` immediately, and lines up with Standing Decision #2 (sovereignty Day 1, no new vendor dependencies). Hosted MCP migration is a Phase 1 task.

The MCP server itself is not built by Gate 2; it's a follow-up. Capture-tool.ts is the schema that the MCP server (or webhook proxy) will register. Pick the architecture, write the proxy, then come back here to test.

---

## Manual checklist (claude.ai side)

Do these in order. Estimated 20 minutes.

1. **Open claude.ai and create a new Project.** Call it `GAT-BOS Capture`. (Settings > Projects > New Project.)

2. **Paste the system prompt.** Open `docs/task-system/claude-project-prompt.md` in your editor. Copy the entire file from `# GAT-BOS Capture -- Claude Project System Prompt` to the bottom. Paste verbatim into the Project's system prompt / custom instructions field. Do not paraphrase. Do not abbreviate.

3. **Configure the capture tool.** This step depends on the wiring choice above:
   - **Option A (MCP):** Connect the MCP server you stood up. Verify the `capture_to_task_system` tool appears in the Project's available tools list.
   - **Option B (webhook):** Add the tool to the Project's custom tools. Paste the input schema from `src/lib/claude-tools/capture-tool.ts` (`captureTool.input_schema`). Set the handler URL to your webhook proxy.

4. **Confirm the area enum lock.** Whichever wiring you chose, the tool's `hints.area` enum must match the 5 fixed areas: `Sales Production`, `Agent Partnerships`, `GAT-BOS Build`, `BNI / SAAR / WCR`, `Personal`. The TS file has this baked in; verify the JSON schema in the Project matches.

5. **Test with a 5-minute conversation.** Walk through these 3 captures in order. Each should produce a tool call followed by a one-line summary in Claude's reply.

   - "Just got off a call with Julie Jarmiolowski. She's pumped about the Camelview 4205 listing. Sending over photos tomorrow."
     - Expected: tool call with `hints.type='interaction'`, `hints.contact='Julie Jarmiolowski'`. Response 201. Claude summarizes "Logged interaction with Julie; contact matched. Cadence touched."
   - "Add a task to draft the Christine McConnell co-brand strip for the Unit 4205 flyer."
     - Expected: tool call with `hints.type='task'`, `hints.contact='Julie Jarmiolowski'` or `hints.project='Optima Camelview Unit 4205 listing marketing'` (depending on what Claude infers). Response 201.
   - "I think I need a new area for tracking lender relationships."
     - Expected: NO tool call. Claude responds with the area-fixed-at-5 explanation and offers to log a task under GAT-BOS Build instead.

6. **Verify the rows landed.** Run this against your local Supabase:

   ```sh
   psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" \
     -c "SELECT type, title, metadata->>'source' AS source, created_at FROM public.nodes WHERE created_at > now() - interval '10 minutes' ORDER BY created_at;"
   ```

   You should see two new rows (interaction + task), both with `metadata->>'source' = 'claude'` or whatever the wiring layer sets. The area attempt should have produced no row.

7. **Confirm the cadence side-effect.** Julie's `cadences.last_touched_at` should be within the last 10 minutes:

   ```sh
   psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" \
     -c "SELECT n.title, c.last_touched_at, c.next_due_at FROM cadences c JOIN nodes n ON n.id=c.contact_id WHERE n.title ILIKE 'Julie%';"
   ```

---

## What to do if a test conversation fails

| Symptom | Likely cause | Fix |
|---|---|---|
| Claude responds but no tool call fires | System prompt didn't paste correctly, or tool isn't registered in the Project | Re-paste prompt verbatim; re-check the tool configuration in the Project settings |
| Tool call returns HTTP 401 | Bearer token missing in the MCP / webhook layer | Grep `~/crm/.env.local` for `INTERNAL_API_TOKEN`; make sure your proxy reads it |
| Tool call returns HTTP 404 | Endpoint URL wrong | If local, check the port from `pnpm dev` output (3000, 3001, 3002 -- whichever is free); if remote, deploy the branch first |
| Tool call returns HTTP 422 with `areas_not_writable` | Claude tried to create an area despite the prompt | Re-check the prompt is verbatim; the "Example 7" section is the load-bearing instruction. If the prompt is correct and it still happens, file a Phase 1 ticket to tighten |
| Tool call returns HTTP 500 with `OWNER_USER_ID env var not set` | Env not loaded by the API route at runtime | If local: restart `pnpm dev` (env reload). If remote: `vercel env ls` and confirm `OWNER_USER_ID` is set in Production |
| Tool call returns HTTP 201 but `warnings` is non-empty | Contact / project / area hint didn't resolve | Mention this back in conversation -- not a failure. Add the missing parent first via a separate capture, then re-capture the original |

---

## Stop here. Gate 2 ends at this checklist.

Claude Code's Gate 2 work ends at the three deliverables in this commit. The Claude Project setup on claude.ai is your manual step. When you've finished the test conversation in step 5 and verified the rows landed in step 6, Gate 2 is closed and Gate 3 (seed 25 agents) can begin.

If anything in this doc is wrong about claude.ai's current Project / tool configuration UX, that's drift between when the brief was written and now; let Claude Code know and we'll patch.

---

## Gate 3 entry conditions (Phase 0 paused state)

Phase 0 is paused after Gate 2 sign-off (commit `03983a0`) pending the MCP server scope decision. Gate 3 cannot start until ALL of the following land. Listed here so the next session has the full picture:

- **a.** Local MCP server built. Scope decided in next session. The server registers `capture_to_task_system` (schema from `src/lib/claude-tools/capture-tool.ts`), holds `INTERNAL_API_TOKEN` in its own environment, and forwards each invocation to `http://localhost:<port>/api/captures` with `target: "task_system"` and `source: "claude"` injected. Treat as scope-it-first, then build.
- **b.** Manual claude.ai Project setup completed by Alex using the built MCP server. The 7-step checklist above runs end-to-end.
- **c.** 3-capture test conversation in step 5 passes. Rows visible in `public.nodes` and `public.node_events`.
- **d.** Destructive-bash hook bypass granted for `supabase db reset --local`. Requested explicitly in Gate 3 kickoff message; granted for that one command only; hook stays on for everything else.
- **e.** Local DB drift cleared via the reset (duplicate "Agent Partnerships" area, 3 Julie cadence rows, ad-hoc test 7 area). See `BLOCKERS.md` entry "Task System Phase 0 -- local dev DB drift" for the catalog.
- **f.** Agent source confirmed: `~/Documents/Alex Hub(Obs)/wiki/agents/`. Per Standing Decision #4 / item #5 in the brief carry-forward.

Phase 1 entry conditions are not scoped here; they begin only after Phase 0 ships end-to-end (morning brief landing in Alex's inbox).
