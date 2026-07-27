# Modal & dialog playbook (for agents)

Use this with **Browser Execution Runtime (BER)** when pages show overlays, auth walls, or native JS dialogs.

## 1. Always observe first

```bash
npm run call -- browser_observe '{}'
# or GET http://127.0.0.1:8787/observe
```

Read `signals` (not screenshots):

| Signal | Meaning | Agent action |
|--------|---------|----------------|
| `cookie_banner`, `modal:cookie` | Consent CMP | `dismiss_overlays` or let recovery run; optional Accept step |
| `modal:newsletter` | Subscribe popup | Close / Not now / Escape |
| `modal:login`, `password_field` | Sign-in wall | **Type credentials** from user secrets — do not auto-dismiss |
| `modal:otp` | 2FA / SMS code | **Type OTP** from user/env — recovery will not dismiss |
| `modal:payment` | Pay / checkout confirm | Only click Pay if user asked **and** `allowPurchase` policy |
| `modal:critical` | `alertdialog` | Read copy; explicit user confirm in plan |
| `has_dialog` | Generic modal present | Check other `modal:*` signals |

Recovery problem kinds (in events / failed steps): `auth_required`, `otp_required`, `payment_confirm`, `cookie_banner`, `dialog_blocking`.

## 2. URL and behavior changes

After each step (or use `browser_diff`):

- `diff.urlChanged`, `diff.summary` — navigation and SPA transitions
- `+signal` / `-signal` — overlay appeared or cleared
- `+button` / `-button` — new actions available

Prefer **`browser_run_plan`** with short deterministic steps when the flow is known.

## 3. Example plans

### Cookie (safe auto-recovery)

```json
{
  "goal": "accept cookies and continue",
  "steps": [
    { "action": { "type": "dismiss_overlays" } },
    { "action": { "type": "click", "target": { "role": "button", "name": "Continue" } } }
  ]
}
```

### Login (agent supplies secrets)

```json
{
  "goal": "sign in",
  "steps": [
    { "action": { "type": "type", "target": { "placeholder": "Email" }, "text": "<FROM_USER>" } },
    { "action": { "type": "type", "target": { "placeholder": "Password" }, "text": "<FROM_USER>" } },
    { "action": { "type": "click", "target": { "role": "button", "name": "Continue" } } }
  ]
}
```

### OTP

```json
{
  "goal": "verify otp",
  "steps": [
    {
      "action": {
        "type": "type",
        "target": { "placeholder": "verification code" },
        "text": "<OTP_FROM_USER_OR_ENV>"
      }
    },
    { "action": { "type": "click", "target": { "role": "button", "name": "Verify" } } }
  ]
}
```

Set native `prompt()` OTP via env: `BER_DIALOG_PROMPT_DEFAULT=123456` (daemon restart).

## 4. Policy & env

| Var / policy | Default | Use |
|--------------|---------|-----|
| `allowPurchase` | false | Blocks Pay now / checkout clicks |
| `autoDismissDialogs` | true | Native alert/confirm/prompt won’t hang Playwright |
| `autoDismissNativeConfirm` | false | Risky confirms dismissed, not accepted |
| `BER_DIALOG_PROMPT_DEFAULT` | — | Text for native `prompt()` (e.g. OTP) |
| `BER_AUTO_DISMISS_DIALOGS=0` | — | Disable native auto-handle |
| `BER_AUTO_FOCUS_POPUP_TABS=0` | — | Don’t switch to `window.open` tabs |

## 5. Cursor & Codex

- Cursor: `.cursor/rules/ber-runtime.mdc` + `examples/integrations/cursor-rules.md`
- Codex: `examples/integrations/codex-prompt.md` (includes modal rules)

## 6. Local test fixtures

Under `fixtures/`: `cookie-shop.html`, `login-local.html`, `otp-local.html`, `payment-confirm-local.html`.

```bash
npm run test:browser
DISPLAY=:1 BER_HEADLESS=0 npm run test:browser
```
