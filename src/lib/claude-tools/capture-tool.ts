// Anthropic function-calling tool spec for the GAT-BOS Capture conversation.
//
// Where this is used:
//   - The system prompt at docs/task-system/claude-project-prompt.md tells the
//     Claude Project on claude.ai to invoke this tool any time Alex describes
//     a task, contact, project, interaction, shipped event, or area-scoped
//     action.
//   - The Project itself is configured on claude.ai (manual step in setup.md).
//     The tool definition below is the shape Claude expects when registering
//     a custom tool whose handler POSTs to /api/captures.
//
// Why the shape diverges slightly from the raw POST body:
//   - `target` and `source` are intentionally NOT exposed to the model. The
//     handler at /api/captures defaults `source` from the runtime context
//     (set to "claude" by whatever proxy actually forwards the call) and the
//     Claude Project's adapter always pins `target` to "task_system" before
//     POSTing. Keeping them off the tool input prevents the model from ever
//     mis-routing a capture to the legacy "captures" table.
//   - `hints.type='area'` is allowed by the spec but the /api/captures route
//     rejects area creation with HTTP 422 (areas are fixed at 5 per handoff
//     Section 3.5; new areas require a migration). The system prompt repeats
//     this constraint so Claude never even tries.
//
// This file is type-checked but not imported by any runtime route yet. It
// lives here so future server-side wrappers (Anthropic Messages API direct
// calls, MCP server adapters, etc.) can import the canonical spec instead
// of re-deriving it.

import type { Tool } from "@anthropic-ai/sdk/resources/messages";

export const CAPTURE_TOOL_NAME = "capture_to_task_system" as const;

export const captureTool: Tool = {
  name: CAPTURE_TOOL_NAME,
  description: [
    "Persist a captured thought, task, contact, project, interaction, or shipped event into the GAT-BOS task system.",
    "",
    "Call this any time Alex describes:",
    "- a task he needs to do or is waiting on (use type='task')",
    "- a project with a defined end state and deadline (use type='project')",
    "- a person he interacts with as part of his real estate title work (use type='contact')",
    "- a touchpoint with a contact: a call, text, meeting, coffee, broker open, lunch, note (use type='interaction')",
    "- a shipped deliverable, decision, or other immutable timestamped log entry (use type='event')",
    "",
    "Never call this to create an 'area'. Areas are fixed at 5 (Sales Production, Agent Partnerships, GAT-BOS Build, BNI / SAAR / WCR, Personal) and new ones require a database migration, not a capture. If a new responsibility surfaces that doesn't fit those 5, surface it back to Alex in conversation; do not call the tool.",
    "",
    "Always include hints when context makes them obvious. hints.contact/project/area are name lookups against existing nodes; the route's resolver matches by title (case-insensitive) and silently falls back if no match is found (a warning is returned in the response). hints.tier is required for new contacts (1=Tier 1 top producer, 7-day cadence; 2=Tier 2 active partner, 14-day cadence; 3=Tier 3 maintenance, 30-day cadence). When in doubt about tier, choose 3 and Alex can promote later.",
    "",
    "Default response is HTTP 201 with { id, type, inferred, warnings }. A non-empty warnings array means the row landed but with degraded context (e.g. a referenced project name didn't match any existing project node). Surface warnings back to Alex briefly in the conversation; do not retry with a different shape.",
  ].join("\n"),
  input_schema: {
    type: "object",
    properties: {
      raw_text: {
        type: "string",
        description:
          "The full natural-language description Alex provided. Preserve his voice; do not summarize. The body of the node is set verbatim from this string.",
      },
      hints: {
        type: "object",
        description:
          "Structured context. Provide every hint the conversation makes obvious; the resolver tolerates partial hints.",
        properties: {
          type: {
            type: "string",
            enum: ["task", "project", "contact", "interaction", "event"],
            description:
              "The node type. Note: 'area' is intentionally not in this enum; areas are fixed at 5 and not capturable.",
          },
          contact: {
            type: "string",
            description:
              "Name of the contact this capture relates to. Use 'First Last' as Alex says it. Required for interactions. Optional for events when a project/area is the primary anchor.",
          },
          project: {
            type: "string",
            description:
              "Title of the parent project, if the capture lives inside a project. Tasks created under a project should set this. Events shipped as part of a project should set this.",
          },
          area: {
            type: "string",
            description:
              "Name of the parent area, if the capture lives directly under an area (no project). Must be one of the 5 fixed areas: 'Sales Production', 'Agent Partnerships', 'GAT-BOS Build', 'BNI / SAAR / WCR', 'Personal'.",
            enum: [
              "Sales Production",
              "Agent Partnerships",
              "GAT-BOS Build",
              "BNI / SAAR / WCR",
              "Personal",
            ],
          },
          tier: {
            type: "integer",
            enum: [1, 2, 3],
            description:
              "Tier assignment for a new contact. 1=top producer (7-day cadence), 2=active partner (14-day), 3=maintenance (30-day). Required when type='contact'. Defaults to 3 if omitted, with a warning.",
          },
        },
        additionalProperties: false,
      },
    },
    required: ["raw_text"],
    additionalProperties: false,
  },
};

// Shape of the tool input the model will produce. Kept in sync with
// input_schema above. Used by any server-side adapter that wants to type-check
// the tool_use block before forwarding to /api/captures.
export interface CaptureToolInput {
  raw_text: string;
  hints?: {
    type?: "task" | "project" | "contact" | "interaction" | "event";
    contact?: string;
    project?: string;
    area?:
      | "Sales Production"
      | "Agent Partnerships"
      | "GAT-BOS Build"
      | "BNI / SAAR / WCR"
      | "Personal";
    tier?: 1 | 2 | 3;
  };
}
