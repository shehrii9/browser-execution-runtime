import { Policy, PolicySchema } from "./types.js";

export function createPolicy(partial: Partial<Policy> = {}): Policy {
  return PolicySchema.parse(partial);
}

export function assertNavigationAllowed(url: string, policy: Policy): void {
  if (policy.domains.length === 0 || policy.allowNavigationOutsideAllowlist) {
    return;
  }
  let hostname: string;
  try {
    hostname = new URL(url).hostname;
  } catch {
    throw new Error(`Invalid navigation URL: ${url}`);
  }
  const allowed = policy.domains.some(
    (domain) => hostname === domain || hostname.endsWith(`.${domain}`),
  );
  if (!allowed) {
    throw new Error(
      `Navigation blocked by policy. Host "${hostname}" is not in allowlist: ${policy.domains.join(", ")}`,
    );
  }
}

export function looksLikePurchaseIntent(text: string): boolean {
  return /\b(buy|purchase|checkout|pay now|place order|add to cart and pay)\b/i.test(
    text,
  );
}
