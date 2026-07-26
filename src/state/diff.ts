import type { SemanticState, StateDiff } from "../types.js";

export function diffStates(
  before: SemanticState | undefined,
  after: SemanticState,
): StateDiff {
  if (!before) {
    return {
      urlChanged: false,
      titleChanged: false,
      addedSignals: after.signals,
      removedSignals: [],
      addedButtons: after.buttons.slice(0, 10),
      removedButtons: [],
      addedDialogs: after.dialogs,
      removedDialogs: [],
      summary: [`Initial state on ${after.domain} (${after.pageHint})`],
    };
  }

  const addedSignals = after.signals.filter((s) => !before.signals.includes(s));
  const removedSignals = before.signals.filter((s) => !after.signals.includes(s));
  const addedButtons = after.buttons.filter((b) => !before.buttons.includes(b));
  const removedButtons = before.buttons.filter((b) => !after.buttons.includes(b));
  const addedDialogs = after.dialogs.filter((d) => !before.dialogs.includes(d));
  const removedDialogs = before.dialogs.filter((d) => !after.dialogs.includes(d));

  const summary: string[] = [];
  if (before.url !== after.url) summary.push(`URL: ${before.url} → ${after.url}`);
  if (before.title !== after.title) summary.push(`Title: ${before.title} → ${after.title}`);
  if (before.pageHint !== after.pageHint) {
    summary.push(`Page: ${before.pageHint} → ${after.pageHint}`);
  }
  for (const s of addedSignals) summary.push(`+signal ${s}`);
  for (const s of removedSignals) summary.push(`-signal ${s}`);
  for (const d of addedDialogs) summary.push(`+dialog ${d}`);
  for (const d of removedDialogs) summary.push(`-dialog ${d}`);
  for (const b of addedButtons.slice(0, 5)) summary.push(`+button ${b}`);
  for (const b of removedButtons.slice(0, 5)) summary.push(`-button ${b}`);
  if (summary.length === 0) summary.push("No meaningful state change");

  return {
    urlChanged: before.url !== after.url,
    titleChanged: before.title !== after.title,
    addedSignals,
    removedSignals,
    addedButtons,
    removedButtons,
    addedDialogs,
    removedDialogs,
    summary,
  };
}
