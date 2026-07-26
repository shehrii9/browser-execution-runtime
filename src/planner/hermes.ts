/** @deprecated Import from `./llm.js` — Hermes is just one optional provider. */
export {
  LlmPlanner as HermesPlanner,
  LlmComputerUseFallback as HermesComputerUseFallback,
  createLlmPlannerFromEnv as createHermesPlannerFromEnv,
  LlmPlanner,
  LlmComputerUseFallback,
  createLlmPlannerFromEnv,
  resolveLlmEnv,
} from "./llm.js";
export type { LlmPlannerOptions as HermesPlannerOptions, LlmPlannerOptions } from "./llm.js";
