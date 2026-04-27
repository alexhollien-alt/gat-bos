// Slice 6 shim. Original implementation moved to src/lib/ai/morning-brief.ts.
// This file remains for one slice cycle so existing imports keep working;
// schedule deletion in Slice 7 (see LATER.md).
//
// Slice 4 -> Slice 6: assembleBrief is the same function as runMorningBrief,
// re-exported under its old name to preserve the brief-client.ts call shape.

export {
  PROMPT_VERSION,
  runMorningBrief as assembleBrief,
  type BriefTier,
  type BriefRankedContact,
  type BriefCongratsItem,
  type BriefInput,
  type BriefUsage,
  type BriefResult,
} from "@/lib/ai/morning-brief";
