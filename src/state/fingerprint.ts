import { createHash } from "node:crypto";
import type { SemanticState } from "../types.js";

export function buildSignals(state: Omit<SemanticState, "fingerprint" | "observedAt">): string[] {
  const signals = new Set<string>();
  signals.add(`page:${state.pageHint}`);
  if (state.dialogs.length) signals.add("has_dialog");
  if (state.buttons.some((b) => /cookie|consent|accept/i.test(b))) {
    signals.add("cookie_banner");
  }
  if (state.buttons.some((b) => /log ?in|sign ?in/i.test(b))) {
    signals.add("login_available");
  }
  if (state.buttons.some((b) => /check ?out|buy|purchase/i.test(b))) {
    signals.add("checkout_available");
  }
  if (state.buttons.some((b) => /skip ?ad|^skip$/i.test(b))) {
    signals.add("skip_ad");
  }
  if (state.inputs.some((i) => /password/i.test(i))) {
    signals.add("password_field");
  }
  if (state.inputs.some((i) => /search/i.test(i))) {
    signals.add("search_field");
  }
  if (state.nodes.some((n) => n.role === "video" || n.tag === "video")) {
    signals.add("video_player");
  }
  if (state.pageHint === "watch" || state.pageHint === "results") {
    signals.add(`hint:${state.pageHint}`);
  }
  for (const dialog of state.dialogs.slice(0, 5)) {
    signals.add(`dialog:${normalizeToken(dialog)}`);
  }
  return [...signals].sort();
}

export function fingerprintFromParts(parts: {
  domain: string;
  pageHint: string;
  signals: string[];
  buttons: string[];
  dialogs: string[];
}): string {
  const signals = [...parts.signals].map(normalizeToken).sort();
  const dialogs = [...parts.dialogs].map((d) => `d:${normalizeToken(d)}`).sort().slice(0, 8);
  const buttons = [...parts.buttons].map((b) => `b:${normalizeToken(b)}`).sort().slice(0, 12);
  const material = [parts.domain, parts.pageHint, ...signals, ...dialogs, ...buttons].join("|");
  return createHash("sha256").update(material).digest("hex").slice(0, 16);
}

export function pageHintFromUrl(url: string, title: string): string {
  try {
    const u = new URL(url);
    const host = u.hostname.toLowerCase();
    const path = u.pathname.toLowerCase();
    if (host.includes("youtube.com") || host === "youtu.be") {
      if (path.startsWith("/watch") || host === "youtu.be") return "watch";
      if (path.startsWith("/results") || u.searchParams.has("search_query")) {
        return "results";
      }
      if (path.startsWith("/shorts")) return "shorts";
      if (path === "/" || path === "") return "home";
      return "video_site";
    }
    if (path.includes("checkout") || path.includes("cart")) return "checkout";
    if (path.includes("login") || path.includes("signin")) return "login";
    if (path.includes("search") || u.searchParams.has("q")) return "search";
    if (path.includes("/watch") || path.includes("/video")) return "watch";
    if (path.includes("product") || path.includes("/dp/") || path.includes("/p/")) {
      return "product";
    }
    if (path === "/" || path === "") return "home";
  } catch {
    // ignore
  }
  const t = title.toLowerCase();
  if (t.includes("checkout") || t.includes("cart")) return "checkout";
  if (t.includes("sign in") || t.includes("log in")) return "login";
  if (t.includes("search") || t.includes("youtube")) return "search";
  return "page";
}

function normalizeToken(value: string): string {
  return value.toLowerCase().replace(/\s+/g, " ").trim().slice(0, 40);
}
