import type { Page } from "playwright";
import type { SemanticNode, SemanticState } from "../types.js";
import {
  buildSignals,
  fingerprintFromParts,
  pageHintFromUrl,
} from "./fingerprint.js";

interface RawNode {
  role: string;
  name: string;
  text: string;
  placeholder: string;
  value: string;
  enabled: boolean;
  visible: boolean;
  checked: boolean | null;
  href: string;
  tag: string;
}

// Kept as a string so bundlers/tsx cannot inject helpers into the browser context.
const COLLECT_NODES_SCRIPT = `(() => {
  const interestingRoles = new Set([
    "button",
    "link",
    "textbox",
    "searchbox",
    "checkbox",
    "radio",
    "combobox",
    "menuitem",
    "tab",
    "dialog",
    "alertdialog",
  ]);

  const isVisible = (el) => {
    const style = window.getComputedStyle(el);
    const rect = el.getBoundingClientRect();
    return (
      style.visibility !== "hidden" &&
      style.display !== "none" &&
      rect.width > 0 &&
      rect.height > 0
    );
  };

  const roleOf = (el) => {
    const explicit = el.getAttribute("role");
    if (explicit) return explicit;
    const tag = el.tagName.toLowerCase();
    if (tag === "button") return "button";
    if (tag === "a") return "link";
    if (tag === "select") return "combobox";
    if (tag === "textarea") return "textbox";
    if (tag === "input") {
      const type = (el.getAttribute("type") || "text").toLowerCase();
      if (type === "checkbox") return "checkbox";
      if (type === "radio") return "radio";
      if (type === "search") return "searchbox";
      if (["button", "submit"].includes(type)) return "button";
      return "textbox";
    }
    if (tag === "dialog") return "dialog";
    return tag;
  };

  const nameOf = (el) => {
    return (
      el.getAttribute("aria-label") ||
      el.getAttribute("name") ||
      el.getAttribute("title") ||
      (el.innerText || "").trim() ||
      ""
    )
      .replace(/\\s+/g, " ")
      .trim()
      .slice(0, 80);
  };

  const nodes = [];
  const elements = Array.from(
    document.querySelectorAll(
      "a, button, input, textarea, select, [role], dialog, [aria-modal='true']",
    ),
  );

  for (const el of elements) {
    if (!isVisible(el)) continue;
    const role = roleOf(el);
    const tag = el.tagName.toLowerCase();
    if (
      !interestingRoles.has(role) &&
      !["button", "a", "input", "textarea", "select", "dialog"].includes(tag)
    ) {
      continue;
    }
    nodes.push({
      role,
      name: nameOf(el),
      text: (el.innerText || "").replace(/\\s+/g, " ").trim().slice(0, 80),
      placeholder: el.getAttribute("placeholder") || "",
      value: typeof el.value === "string" ? el.value.slice(0, 80) : "",
      enabled: !el.disabled,
      visible: true,
      checked: typeof el.checked === "boolean" ? el.checked : null,
      href: el.href || "",
      tag,
    });
    if (nodes.length >= 120) break;
  }
  return nodes;
})()`;

export async function observePage(page: Page): Promise<SemanticState> {
  const url = page.url();
  const title = await page.title();
  const domain = safeHostname(url);
  const pageHint = pageHintFromUrl(url, title);

  const rawNodes = (await page.evaluate(COLLECT_NODES_SCRIPT)) as RawNode[];

  const nodes: SemanticNode[] = rawNodes.map((n, index) => ({
    id: `n${index}`,
    role: n.role,
    name: n.name,
    text: n.text || n.name,
    placeholder: n.placeholder || undefined,
    value: n.value || undefined,
    enabled: n.enabled,
    visible: n.visible,
    checked: n.checked ?? undefined,
    href: n.href || undefined,
    tag: n.tag,
  }));

  const buttons = unique(
    nodes
      .filter((n) => n.role === "button" || n.tag === "button")
      .map((n) => n.name || n.text)
      .filter(Boolean),
  );
  const inputs = unique(
    nodes
      .filter((n) => ["textbox", "searchbox", "combobox"].includes(n.role))
      .map((n) => n.name || n.placeholder || n.role)
      .filter(Boolean),
  );
  const links = unique(
    nodes
      .filter((n) => n.role === "link")
      .map((n) => n.name || n.text)
      .filter(Boolean),
  );
  const dialogs = unique(
    nodes
      .filter((n) => n.role === "dialog" || n.role === "alertdialog")
      .map((n) => n.name || n.text || "dialog")
      .filter(Boolean),
  );

  const base = {
    url,
    title,
    domain,
    pageHint,
    dialogs,
    buttons,
    inputs,
    links,
    nodes,
    signals: [] as string[],
  };
  const signals = buildSignals(base);
  const fingerprint = fingerprintFromParts({
    domain,
    pageHint,
    signals,
    buttons,
    dialogs,
  });

  return {
    ...base,
    signals,
    fingerprint,
    observedAt: new Date().toISOString(),
  };
}

function safeHostname(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return "unknown";
  }
}

function unique(values: string[]): string[] {
  return [...new Set(values.map((v) => v.replace(/\s+/g, " ").trim()).filter(Boolean))];
}
