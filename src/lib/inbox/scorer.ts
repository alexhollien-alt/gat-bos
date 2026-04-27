// Slice 6 shim. Implementation moved to src/lib/ai/inbox-score.ts so all
// AI call sites share the budget guard, cache helper, and ai_usage_log writer.
// Kept here as a re-export for one slice cycle (see LATER.md).

export { scoreThread } from "@/lib/ai/inbox-score";
