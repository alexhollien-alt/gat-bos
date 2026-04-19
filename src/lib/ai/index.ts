// src/lib/ai/index.ts
// Barrel export for the AI utility layer.

export { createAdvisedCompletion, stripAdviserFromHistory } from "./adviser";
export { MODEL_ROUTING, COST_PER_MTK } from "@/config/model-routing";
export type {
  FeatureKey,
  AdvisedCompletionOptions,
  AdvisedCompletionResult,
} from "./types";
