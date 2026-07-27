const daemonInput = document.getElementById("daemon");
const out = document.getElementById("out");

async function getDaemon() {
  const stored = await chrome.storage.sync.get(["daemonUrl"]);
  return stored.daemonUrl || "http://127.0.0.1:8787";
}

async function setDaemon(url) {
  await chrome.storage.sync.set({ daemonUrl: url });
}

function show(value, ok) {
  out.className = ok ? "ok" : "bad";
  out.textContent = typeof value === "string" ? value : JSON.stringify(value, null, 2);
}

async function currentTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.url) throw new Error("No active tab URL");
  return tab;
}

async function api(path, init) {
  const base = daemonInput.value.replace(/\/$/, "");
  await setDaemon(base);
  const res = await fetch(`${base}${path}`, {
    ...init,
    headers: {
      "content-type": "application/json",
      ...(init?.headers || {}),
    },
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
}

daemonInput.value = await getDaemon();

document.getElementById("ping").onclick = async () => {
  try {
    const health = await api("/health");
    const info = await api("/extension/info");
    show({ health, info }, true);
  } catch (error) {
    show(error instanceof Error ? error.message : String(error), false);
  }
};

document.getElementById("observe").onclick = async () => {
  try {
    const tab = await currentTab();
    show(
      {
        tip: "Extension bridge reports tab metadata. Full CDP control uses daemon attach/cdpUrl.",
        tab: { id: tab.id, title: tab.title, url: tab.url },
        cdpHint:
          "Launch Chrome with --remote-debugging-port=9222 then attach via cdpUrl http://127.0.0.1:9222",
      },
      true,
    );
  } catch (error) {
    show(error instanceof Error ? error.message : String(error), false);
  }
};

document.getElementById("attach").onclick = async () => {
  try {
    const tab = await currentTab();
    if (!/^https?:/i.test(tab.url || "")) {
      throw new Error("Only http(s) tabs can be attached by URL");
    }
    const result = await api("/attach", {
      method: "POST",
      body: JSON.stringify({ startUrl: tab.url, profile: "persistent" }),
    });
    show(
      {
        attached: result.ok,
        url: result.state?.url,
        title: result.state?.title,
        note: "Runtime launched/attached and navigated to this tab URL.",
      },
      true,
    );
  } catch (error) {
    show(error instanceof Error ? error.message : String(error), false);
  }
};
