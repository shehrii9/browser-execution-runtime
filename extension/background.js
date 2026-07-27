chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.sync.set({ daemonUrl: "http://127.0.0.1:8787" });
});

async function daemonBase() {
  const stored = await chrome.storage.sync.get(["daemonUrl"]);
  return (stored.daemonUrl || "http://127.0.0.1:8787").replace(/\/$/, "");
}

chrome.commands.onCommand.addListener(async (command) => {
  if (command !== "observe-tab") return;
  const base = await daemonBase();
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.url) return;

  try {
    const res = await fetch(`${base}/observe`);
    const state = await res.json();
    if (!res.ok) throw new Error(state.error || `HTTP ${res.status}`);
    await chrome.storage.session.set({
      lastObserve: state,
      lastObservedTab: { url: tab.url, title: tab.title, daemon: base },
    });
    const modalCount = (state.signals ?? []).filter((s) => String(s).startsWith("modal:")).length;
    await chrome.action.setBadgeText({ text: modalCount ? String(modalCount) : "·" });
    await chrome.action.setBadgeBackgroundColor({ color: "#0f6b5c" });
  } catch {
    await chrome.action.setBadgeText({ text: "!" });
    await chrome.action.setBadgeBackgroundColor({ color: "#9b2c2c" });
    await chrome.storage.session.set({
      lastObservedTab: { url: tab.url, title: tab.title, daemon: base, error: "observe failed" },
    });
  }
});
