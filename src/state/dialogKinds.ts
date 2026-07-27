import type { SemanticState } from "../types.js";

export type ModalKind =
  | "cookie"
  | "login"
  | "otp"
  | "payment"
  | "newsletter"
  | "critical"
  | "generic";

const COOKIE_RE = /\b(cookie|consent|gdpr|privacy preference|we use cookies)\b/i;
const LOGIN_RE =
  /\b(log ?in|sign ?in|sign up|create account|register|password|email address|username)\b/i;
const OTP_RE =
  /\b(otp|one[- ]time|verification code|verify code|enter code|2fa|two[- ]factor|authenticator|sms code|security code)\b/i;
const PAYMENT_RE =
  /\b(pay now|place order|confirm purchase|billing|card number|payment method)\b/i;
const NEWSLETTER_RE =
  /\b(newsletter|subscribe|stay updated|get updates|join our mailing)\b/i;

function corpus(state: Pick<SemanticState, "dialogs" | "buttons" | "inputs" | "title" | "url">): string {
  return [
    state.title,
    state.url,
    ...state.dialogs,
    ...state.buttons,
    ...state.inputs,
  ]
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Classify visible DOM modals/overlays for agents and recovery policy.
 * Emitted as signals `modal:<kind>` (multiple allowed).
 */
export function inferModalKinds(
  state: Pick<
    SemanticState,
    "dialogs" | "buttons" | "inputs" | "nodes" | "signals" | "pageHint" | "title" | "url"
  >,
): ModalKind[] {
  const kinds = new Set<ModalKind>();
  const text = corpus(state);

  const hasDialog =
    state.dialogs.length > 0 ||
    state.signals.includes("has_dialog") ||
    state.nodes.some((n) => n.role === "dialog" || n.role === "alertdialog");

  if (!hasDialog && !state.signals.includes("cookie_banner")) {
    return [];
  }

  if (state.signals.includes("cookie_banner") || COOKIE_RE.test(text)) {
    kinds.add("cookie");
  }
  if (
    OTP_RE.test(text) ||
    state.inputs.some((i) => OTP_RE.test(i)) ||
    state.nodes.some((n) => OTP_RE.test(`${n.name} ${n.placeholder} ${n.text}`))
  ) {
    kinds.add("otp");
  }
  if (
    state.pageHint === "login" ||
    state.signals.includes("login_available") ||
    state.signals.includes("password_field") ||
    (LOGIN_RE.test(text) && !kinds.has("otp"))
  ) {
    kinds.add("login");
  }
  const dialogText = [...state.dialogs, state.title].join(" ");
  const payButton = state.buttons.some((b) =>
    /\b(pay now|place order|confirm purchase|card number)\b/i.test(b),
  );
  if (
    PAYMENT_RE.test(dialogText) ||
    payButton ||
    (state.pageHint === "checkout" && hasDialog && !kinds.has("cookie"))
  ) {
    kinds.add("payment");
  }
  if (NEWSLETTER_RE.test(text)) {
    kinds.add("newsletter");
  }
  if (state.nodes.some((n) => n.role === "alertdialog")) {
    kinds.add("critical");
  }

  if (kinds.size === 0 && (hasDialog || state.signals.includes("cookie_banner"))) {
    kinds.add("generic");
  }

  // OTP is more specific than login when both match.
  if (kinds.has("otp")) {
    kinds.delete("login");
  }

  return [...kinds].sort();
}

export function modalKindSignals(kinds: ModalKind[]): string[] {
  return kinds.map((k) => `modal:${k}`);
}

export function hasProtectedModal(kinds: ModalKind[]): boolean {
  return kinds.some((k) => k === "login" || k === "otp" || k === "payment" || k === "critical");
}

export function isAutoDismissableModal(kinds: ModalKind[]): boolean {
  if (kinds.length === 0) return true;
  if (hasProtectedModal(kinds)) return false;
  return kinds.every((k) => k === "cookie" || k === "newsletter" || k === "generic");
}
