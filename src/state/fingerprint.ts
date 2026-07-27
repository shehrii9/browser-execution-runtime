import { createHash } from "node:crypto";
import type { SemanticState } from "../types.js";
import { MEDIA_SITE_DOMAINS } from "../plugins/mediaSites.js";

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
  if (state.nodes.some((n) => n.tag === "audio" || n.role === "audio")) {
    signals.add("audio_player");
  }
  if (state.nodes.some((n) => n.tag === "iframe" || n.role === "iframe")) {
    signals.add("has_iframe");
  }
  if (
    state.pageHint === "watch" ||
    state.pageHint === "results" ||
    state.pageHint === "shorts" ||
    state.pageHint === "media_home"
  ) {
    signals.add(`hint:${state.pageHint}`);
  }
  if (isMediaHost(state.domain)) {
    signals.add("media_site");
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

    if (isMediaHost(host)) {
      if (path.includes("/shorts") || path.includes("/reel") || path.includes("/reels")) {
        return "shorts";
      }
      if (
        path.includes("/results") ||
        path.includes("/search") ||
        path.includes("/directory") ||
        u.searchParams.has("q") ||
        u.searchParams.has("search_query")
      ) {
        return "results";
      }
      if (
        path.includes("/watch") ||
        path.includes("/video") ||
        path.includes("/videos/") ||
        path.includes("/clip") ||
        path.includes("/episode") ||
        path.includes("/track") ||
        path.includes("/listen") ||
        host === "youtu.be" ||
        /\/\d{5,}(\/|$)/.test(path)
      ) {
        return "watch";
      }
      if (path === "/" || path === "") return "media_home";
      return "media_site";
    }

    if (path.includes("checkout") || path.includes("cart")) return "checkout";
    if (path.includes("login") || path.includes("signin")) return "login";
    if (path.includes("search") || u.searchParams.has("q")) return "search";
    if (path.includes("/watch") || path.includes("/video") || path.includes("/listen")) {
      return "watch";
    }
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
  if (t.includes("search")) return "search";
  if (/\b(video|watch|stream|podcast|listen)\b/.test(t)) return "watch";
  return "page";
}

export function isMediaHost(domainOrHost: string): boolean {
  const host = domainOrHost.toLowerCase().replace(/^www\./, "");
  return MEDIA_SITE_DOMAINS.some((d) => {
    const bare = d.replace(/^www\./, "");
    return host === bare || host.endsWith(`.${bare}`) || host === d;
  });
}

function normalizeToken(value: string): string {
  return value.toLowerCase().replace(/\s+/g, " ").trim().slice(0, 40);
}
