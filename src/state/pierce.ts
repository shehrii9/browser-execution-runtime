import type { Page } from "playwright";

export interface PiercedRawNode {
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
  pierced: boolean;
}

interface CdpNode {
  nodeName?: string;
  localName?: string;
  nodeValue?: string;
  attributes?: string[];
  children?: CdpNode[];
  shadowRoots?: CdpNode[];
  backendNodeId?: number;
}

/**
 * Best-effort closed-shadow pierce via CDP DOM.getDocument({ pierce: true }).
 * Complements open-shadow page.evaluate walks. Not perfect for all hosts,
 * but recovers many CMP / player controls living in closed shadow roots.
 */
export async function collectPiercedInteractiveNodes(
  page: Page,
  limit = 80,
): Promise<PiercedRawNode[]> {
  let session: Awaited<ReturnType<ReturnType<Page["context"]>["newCDPSession"]>> | null =
    null;
  try {
    session = await page.context().newCDPSession(page);
    const doc = (await session.send("DOM.getDocument", {
      depth: -1,
      pierce: true,
    })) as { root: CdpNode };
    const out: PiercedRawNode[] = [];
    walkCdp(doc.root, out, limit, false);
    return out;
  } catch {
    return [];
  } finally {
    await session?.detach().catch(() => undefined);
  }
}

function walkCdp(
  node: CdpNode,
  out: PiercedRawNode[],
  limit: number,
  inShadow: boolean,
): void {
  if (out.length >= limit) return;

  const tag = (node.localName || node.nodeName || "").toLowerCase();
  const attrs = attrMap(node.attributes);
  // Only emit nodes inside shadow trees — light DOM is already covered by page.evaluate.
  if (inShadow && isInterestingTag(tag, attrs)) {
    const role = roleFrom(tag, attrs);
    const name = (
      attrs["aria-label"] ||
      attrs["name"] ||
      attrs["title"] ||
      attrs["placeholder"] ||
      ""
    )
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 80);
    out.push({
      role,
      name,
      text: name,
      placeholder: attrs["placeholder"] || "",
      value: (attrs["value"] || "").slice(0, 80),
      enabled: attrs["disabled"] === undefined,
      visible: true,
      checked:
        attrs["checked"] !== undefined
          ? attrs["checked"] === "" || attrs["checked"] === "true"
          : null,
      href: attrs["href"] || attrs["src"] || "",
      tag: tag || "node",
      pierced: inShadow,
    });
  }

  for (const child of node.children ?? []) {
    walkCdp(child, out, limit, inShadow);
    if (out.length >= limit) return;
  }
  for (const shadow of node.shadowRoots ?? []) {
    walkCdp(shadow, out, limit, true);
    if (out.length >= limit) return;
  }
}

function attrMap(attributes?: string[]): Record<string, string> {
  const out: Record<string, string> = {};
  if (!attributes) return out;
  for (let i = 0; i + 1 < attributes.length; i += 2) {
    out[String(attributes[i]).toLowerCase()] = String(attributes[i + 1] ?? "");
  }
  return out;
}

function isInterestingTag(tag: string, attrs: Record<string, string>): boolean {
  if (["button", "a", "input", "textarea", "select", "dialog", "video", "audio"].includes(tag)) {
    return true;
  }
  if (/^h[1-6]$/.test(tag)) return true;
  const role = attrs["role"];
  if (
    role &&
    [
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
      "heading",
    ].includes(role)
  ) {
    return true;
  }
  return false;
}

function roleFrom(tag: string, attrs: Record<string, string>): string {
  if (attrs["role"]) return attrs["role"];
  if (tag === "a") return "link";
  if (tag === "button") return "button";
  if (tag === "select") return "combobox";
  if (tag === "textarea") return "textbox";
  if (/^h[1-6]$/.test(tag)) return "heading";
  if (tag === "video") return "video";
  if (tag === "audio") return "audio";
  if (tag === "input") {
    const type = (attrs["type"] || "text").toLowerCase();
    if (type === "checkbox") return "checkbox";
    if (type === "radio") return "radio";
    if (type === "search") return "searchbox";
    if (["button", "submit"].includes(type)) return "button";
    return "textbox";
  }
  if (tag === "dialog") return "dialog";
  return tag || "node";
}
