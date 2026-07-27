import type { Dialog, Page } from "playwright";
import type { Policy } from "../types.js";

const wiredPages = new WeakSet<Page>();

export interface PageLifecycleOptions {
  onPopupPage?: (page: Page) => void;
}

const IMPORTANT_CONFIRM_RE =
  /\b(delete|remove|payment|purchase|pay|logout|sign out|submit order|place order)\b/i;
const OTP_PROMPT_RE = /\b(otp|one[- ]time|verification code|enter code|2fa)\b/i;

/**
 * Auto-handle native JS dialogs (alert/confirm/prompt/beforeunload)
 * so Playwright actions do not hang. Important confirms are dismissed by default.
 */
export function wireNativeDialogs(page: Page, policy: Policy): void {
  if (!policy.autoDismissDialogs) return;
  if (wiredPages.has(page)) return;
  wiredPages.add(page);

  page.on("dialog", async (dialog: Dialog) => {
    try {
      const type = dialog.type();
      const message = dialog.message();

      if (type === "prompt") {
        const defaultText = policy.dialogPromptDefault ?? "";
        if (OTP_PROMPT_RE.test(message) && !defaultText) {
          await dialog.dismiss();
          return;
        }
        await dialog.accept(defaultText);
        return;
      }

      if (type === "confirm") {
        if (
          !policy.autoDismissNativeConfirm &&
          IMPORTANT_CONFIRM_RE.test(message)
        ) {
          await dialog.dismiss();
          return;
        }
        if (policy.autoDismissNativeConfirm) {
          await dialog.accept();
        } else {
          await dialog.dismiss();
        }
        return;
      }

      // alert, beforeunload
      await dialog.accept();
    } catch {
      await dialog.dismiss().catch(() => undefined);
    }
  });
}

export function wirePageLifecycle(
  page: Page,
  policy: Policy,
  options: PageLifecycleOptions = {},
): void {
  wireNativeDialogs(page, policy);
  if (options.onPopupPage) {
    page.on("popup", (popup) => {
      wireNativeDialogs(popup, policy);
      options.onPopupPage?.(popup);
    });
  }
}
