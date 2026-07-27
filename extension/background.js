chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.sync.set({ daemonUrl: "http://127.0.0.1:8787" });
});

chrome.commands.onCommand.addListener(async (command) => {
  if (command !== "observe-tab") return;
  const stored = await chrome.storage.sync.get(["daemonUrl"]);
  const base = (stored.daemonUrl || "http://127.0.0.1:8787").replace(/\/$/, "");
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.url) return;
  await chrome.storage.session.set({
    lastObservedTab: { url: tab.url, title: tab.title, daemon: base },
  });
});
