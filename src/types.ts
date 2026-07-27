import { z } from "zod";

export const TargetRefSchema = z.object({
  role: z.string().optional(),
  name: z.string().optional(),
  text: z.string().optional(),
  placeholder: z.string().optional(),
  css: z.string().optional(),
  testId: z.string().optional(),
  nth: z.number().int().nonnegative().optional(),
  /** Iframe CSS selector, e.g. "iframe#consent" or "iframe[src*='consent']". */
  frame: z.string().optional(),
  /** Match iframe by URL substring when CSS is unknown. */
  frameUrl: z.string().optional(),
});

export type TargetRef = z.infer<typeof TargetRefSchema>;

export const ActionSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("navigate"),
    url: z.string().url(),
    waitUntil: z.enum(["load", "domcontentloaded", "networkidle"]).optional(),
  }),
  z.object({
    type: z.literal("click"),
    target: TargetRefSchema,
  }),
  z.object({
    type: z.literal("type"),
    target: TargetRefSchema,
    text: z.string(),
    clear: z.boolean().optional(),
    pressEnter: z.boolean().optional(),
  }),
  z.object({
    type: z.literal("select"),
    target: TargetRefSchema,
    value: z.string(),
  }),
  z.object({
    type: z.literal("wait"),
    ms: z.number().int().positive().optional(),
    urlIncludes: z.string().optional(),
    text: z.string().optional(),
    target: TargetRefSchema.optional(),
    /** Wait until DOM stops changing (good for SPAs / YouTube-like pages). */
    settle: z.boolean().optional(),
    /** Best-effort networkidle during settle. */
    networkIdle: z.boolean().optional(),
    /** Max wait for settle / target / text (ms). */
    timeoutMs: z.number().int().positive().optional(),
  }),
  z.object({
    type: z.literal("scroll"),
    direction: z.enum(["up", "down"]).default("down"),
    amount: z.number().int().positive().default(800),
    /** After scrolling, wait for late-loaded content. */
    settle: z.boolean().optional(),
  }),
  z.object({
    type: z.literal("extract"),
    target: TargetRefSchema.optional(),
    attribute: z.string().optional(),
    key: z.string().default("value"),
  }),
  z.object({
    type: z.literal("press"),
    key: z.string(),
  }),
  z.object({
    type: z.literal("dismiss_overlays"),
  }),
  z.object({
    type: z.literal("observe"),
  }),
  z.object({
    type: z.literal("new_tab"),
    url: z.string().url().optional(),
  }),
  z.object({
    type: z.literal("switch_tab"),
    index: z.number().int().nonnegative(),
  }),
  z.object({
    type: z.literal("close_tab"),
    index: z.number().int().nonnegative().optional(),
  }),
]);

export type Action = z.infer<typeof ActionSchema>;

export const PlanStepSchema = z.object({
  id: z.string().optional(),
  action: ActionSchema,
  expect: z
    .object({
      urlIncludes: z.string().optional(),
      text: z.string().optional(),
      target: TargetRefSchema.optional(),
    })
    .optional(),
  optional: z.boolean().optional(),
});

export type PlanStep = z.infer<typeof PlanStepSchema>;

export const PlanSchema = z.object({
  goal: z.string(),
  steps: z.array(PlanStepSchema).min(1),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export type Plan = z.infer<typeof PlanSchema>;

export const PolicySchema = z.object({
  allowPurchase: z.boolean().default(false),
  allowNavigationOutsideAllowlist: z.boolean().default(false),
  domains: z.array(z.string()).default([]),
  maxSteps: z.number().int().positive().default(40),
  maxRecoveries: z.number().int().nonnegative().default(3),
  headless: z.boolean().default(true),
  experienceAutoApplyMinConfidence: z.number().min(0).max(1).default(0.8),
});

export type Policy = z.infer<typeof PolicySchema>;

export interface SemanticNode {
  id: string;
  role: string;
  name: string;
  text: string;
  placeholder?: string;
  value?: string;
  enabled: boolean;
  visible: boolean;
  checked?: boolean;
  href?: string;
  tag: string;
}

export interface SemanticState {
  url: string;
  title: string;
  domain: string;
  pageHint: string;
  dialogs: string[];
  buttons: string[];
  inputs: string[];
  links: string[];
  nodes: SemanticNode[];
  signals: string[];
  fingerprint: string;
  observedAt: string;
}

export interface StateDiff {
  urlChanged: boolean;
  titleChanged: boolean;
  addedSignals: string[];
  removedSignals: string[];
  addedButtons: string[];
  removedButtons: string[];
  addedDialogs: string[];
  removedDialogs: string[];
  summary: string[];
}

export interface ExperienceRecord {
  id: number;
  site: string;
  goal: string;
  stateHash: string;
  problem: string;
  fix: Action[];
  success: number;
  failure: number;
  confidence: number;
  lastUsed: string | null;
  createdAt: string;
  pageHint?: string;
  signals?: string[];
  timesUsed?: number;
}

export interface StepResult {
  stepIndex: number;
  stepId?: string;
  ok: boolean;
  action: Action;
  error?: string;
  extracted?: Record<string, string>;
  recovered?: boolean;
  experienceApplied?: number;
  state?: SemanticState;
  diff?: StateDiff;
}

export interface RunResult {
  ok: boolean;
  goal: string;
  steps: StepResult[];
  finalState?: SemanticState;
  llmCallsAvoided: number;
  error?: string;
  resumeFromStep?: number;
  screenshotPath?: string;
  metrics?: {
    durationMs?: number;
    recoveries: number;
    experienceHits: number;
    steps: number;
  };
}

export interface RuntimeStatus {
  attached: boolean;
  url?: string;
  title?: string;
  policy: Policy;
  experienceCount: number;
  memory: {
    l1SessionCached: boolean;
    l2ExperienceCount: number;
    l3VectorIndex: string;
    l3VectorCount: number;
    engine: "typescript+sqlite";
  };
  tabs?: Array<{ index: number; url: string; title: string; active: boolean }>;
  plugins?: string[];
}
