import { describe, expect, it } from "vitest";
import {
  inferModalKinds,
  isAutoDismissableModal,
  hasProtectedModal,
} from "../src/state/dialogKinds.js";
import { classifyProblem, heuristicFixes } from "../src/recovery/engine.js";
import type { SemanticState } from "../src/types.js";

function baseState(partial: Partial<SemanticState>): SemanticState {
  return {
    url: "https://app.example.com",
    title: "App",
    domain: "app.example.com",
    pageHint: "home",
    dialogs: [],
    buttons: [],
    inputs: [],
    links: [],
    nodes: [],
    signals: [],
    fingerprint: "x",
    observedAt: new Date().toISOString(),
    ...partial,
  };
}

describe("modal kind inference", () => {
  it("detects cookie vs login vs otp", () => {
    const cookie = baseState({
      dialogs: ["cookies"],
      buttons: ["Accept all"],
      signals: ["cookie_banner", "has_dialog"],
    });
    expect(inferModalKinds(cookie)).toContain("cookie");
    expect(isAutoDismissableModal(inferModalKinds(cookie))).toBe(true);

    const login = baseState({
      dialogs: ["Sign in"],
      buttons: ["Continue"],
      inputs: ["Email", "Password"],
      signals: ["has_dialog", "password_field", "login_available"],
      pageHint: "login",
    });
    expect(inferModalKinds(login)).toContain("login");
    expect(hasProtectedModal(inferModalKinds(login))).toBe(true);

    const otp = baseState({
      dialogs: ["Verify"],
      inputs: ["Enter verification code"],
      buttons: ["Submit"],
      signals: ["has_dialog"],
    });
    expect(inferModalKinds(otp)).toEqual(["otp"]);
    expect(inferModalKinds(otp)).not.toContain("login");
  });

  it("flags payment and newsletter modals", () => {
    const pay = baseState({
      dialogs: ["Checkout"],
      buttons: ["Pay now"],
      signals: ["has_dialog", "checkout_available"],
    });
    expect(inferModalKinds(pay)).toContain("payment");

    const news = baseState({
      dialogs: ["Subscribe"],
      buttons: ["No thanks"],
      signals: ["has_dialog"],
      title: "Newsletter signup",
    });
    expect(inferModalKinds(news)).toContain("newsletter");
  });
});

describe("recovery respects modal types", () => {
  it("classifies otp and auth without dismiss heuristics", () => {
    const otpState = baseState({
      inputs: ["One-time code"],
      signals: ["modal:otp", "has_dialog"],
    });
    expect(classifyProblem("click failed", otpState)).toBe("otp_required");
    expect(heuristicFixes("otp_required").every((fix) => fix[0]?.type !== "dismiss_overlays")).toBe(
      true,
    );

    const authState = baseState({
      signals: ["modal:login", "password_field", "has_dialog"],
    });
    expect(classifyProblem("blocked", authState)).toBe("auth_required");
  });

  it("still classifies cookie banners", () => {
    expect(
      classifyProblem("click failed", {
        ...baseState({}),
        signals: ["cookie_banner"],
        buttons: ["Accept all"],
      }),
    ).toBe("cookie_banner");
  });
});
