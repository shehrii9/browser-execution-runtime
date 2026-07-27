import { Policy, PolicySchema } from "./types.js";

export function createPolicy(partial: Partial<Policy> = {}): Policy {
  return PolicySchema.parse({
    ...policyDefaultsFromEnv(),
    ...partial,
  });
}

/** Env overrides for dialog/popup policy (see INTEGRATING.md). */
export function policyDefaultsFromEnv(
  env: NodeJS.ProcessEnv = process.env,
): Partial<Policy> {
  const out: Partial<Policy> = {};
  if (env.BER_DIALOG_PROMPT_DEFAULT !== undefined) {
    out.dialogPromptDefault = env.BER_DIALOG_PROMPT_DEFAULT;
  }
  if (env.BER_AUTO_DISMISS_DIALOGS !== undefined) {
    out.autoDismissDialogs = env.BER_AUTO_DISMISS_DIALOGS !== "0";
  }
  if (env.BER_AUTO_FOCUS_POPUP_TABS !== undefined) {
    out.autoFocusPopupTabs = env.BER_AUTO_FOCUS_POPUP_TABS !== "0";
  }
  if (env.BER_AUTO_DISMISS_NATIVE_CONFIRM !== undefined) {
    out.autoDismissNativeConfirm = env.BER_AUTO_DISMISS_NATIVE_CONFIRM === "1";
  }
  return out;
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
