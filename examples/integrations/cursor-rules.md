# Cursor rules snippet (copy/paste)

If you cannot install repo rules, paste this into Cursor project instructions / rules:

```text
Use Browser Execution Runtime (BER) at http://127.0.0.1:8787 for browser tasks.
Tools are defined in examples/agent-tools.json.
Prefer browser_attach → browser_run_plan/browser_execute → browser_observe.
Use browser_diff / browser_events for changes. Avoid screenshot computer-use unless BER recovery fails.
On observe, check signals: modal:cookie (dismiss), modal:login|modal:otp (type user secrets), modal:payment (only if purchase allowed).
Playbook: examples/integrations/modal-playbook.md
No API key is required for BER. Hermes is optional; any agent can wrap the daemon.
CLI: npm run call -- <toolName> '<json>'
```

Canonical always-on/off rule file for this repo:

- `.cursor/rules/ber-runtime.mdc`
