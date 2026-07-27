import type { ReplayScenario } from "./replay-harness.js";

export const REPLAY_SCENARIOS: ReplayScenario[] = [
  {
    id: "cookie-shop",
    fixture: "cookie-shop.html",
    baselineEstimatedLlmCalls: 8,
    plan: (baseUrl) => ({
      goal: "Finish cart flow on cookie shop",
      steps: [
        { action: { type: "navigate", url: baseUrl } },
        {
          action: {
            type: "click",
            target: { role: "button", name: "Checkout" },
          },
        },
        { action: { type: "wait", text: "Done" } },
      ],
    }),
    policy: { maxRecoveries: 4, allowPurchase: true },
  },
  {
    id: "login-wall",
    fixture: "login-local.html",
    baselineEstimatedLlmCalls: 10,
    plan: (baseUrl) => ({
      goal: "sign in on demo app",
      steps: [
        { action: { type: "navigate", url: baseUrl } },
        {
          action: {
            type: "type",
            target: { placeholder: "Email" },
            text: "agent@example.com",
          },
        },
        {
          action: {
            type: "type",
            target: { placeholder: "Password" },
            text: "secret",
          },
        },
        {
          action: {
            type: "click",
            target: { role: "button", name: "Continue" },
          },
        },
        { action: { type: "wait", text: "Signed in" } },
      ],
    }),
    policy: { maxRecoveries: 3 },
  },
  {
    id: "infinite-scroll",
    fixture: "scroll-feed.html",
    baselineEstimatedLlmCalls: 6,
    plan: (baseUrl) => ({
      goal: "scroll feed until item 42",
      steps: [
        { action: { type: "navigate", url: baseUrl } },
        {
          action: {
            type: "scroll",
            direction: "down",
            untilText: "Item 42",
            maxScrolls: 20,
            timeoutMs: 12_000,
          },
        },
        { action: { type: "wait", text: "Item 42", timeoutMs: 3000 } },
      ],
    }),
    policy: { maxRecoveries: 2 },
  },
  {
    id: "media-skip-ad",
    fixture: "media-local.html",
    fixturePath: "/watch/demo",
    baselineEstimatedLlmCalls: 6,
    plan: (baseUrl) => ({
      goal: "skip preroll and start playback",
      steps: [
        { action: { type: "navigate", url: baseUrl } },
        {
          action: {
            type: "click",
            target: { role: "button", name: "Skip Ad" },
          },
        },
        { action: { type: "wait", text: "Now playing" } },
      ],
    }),
    policy: { maxRecoveries: 3 },
  },
];
