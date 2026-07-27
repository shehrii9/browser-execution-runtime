const daemonInput = document.getElementById("daemon");
const out = document.getElementById("out");
const signalsEl = document.getElementById("signals");
const eventsEl = document.getElementById("events");

async function getDaemon() {
  const stored = await chrome.storage.sync.get(["daemonUrl"]);
  return stored.daemonUrl || "http://127.0.0.1:8787";
}

async function setDaemon(url) {
  await chrome.storage.sync.set({ daemonUrl: url });
}

function show(value, ok = true) {
  out.className = ok ? "ok" : "bad";
  out.textContent = typeof value === "string" ? value : JSON.stringify(value, null, 2);
}

function renderSignals(signals = []) {
  signalsEl.replaceChildren();
  const interesting = signals.filter(
    (s) =>
      s.startsWith("modal:") ||
      s.includes("cookie") ||
      s.includes("dialog") ||
      s.includes("login") ||
      s.includes("otp") ||
      s.includes("payment"),
  );
  const list = interesting.length ? interesting : signals.slice(0, 8);
  if (!list.length) {
    const empty = document.createElement("span");
    empty.style.color = "#8a8175";
    empty.style.fontSize = "11px";
    empty.textContent = "No signals (observe after attach).";
    signalsEl.appendChild(empty);
    return;
  }
  for (const sig of list) {
    const chip = document.createElement("span");
    chip.className =
      sig.startsWith("modal:login") ||
      sig.startsWith("modal:otp") ||
      sig.startsWith("modal:payment")
        ? "chip warn"
        : "chip";
    chip.textContent = sig;
    signalsEl.appendChild(chip);
  }
}

function renderEvents(events = []) {
  eventsEl.replaceChildren();
  for (const ev of events) {
    const row = document.createElement("div");
    row.className = "ev";
    const msg = ev.message ? ` — ${ev.message}` : "";
    row.textContent = `#${ev.id} ${ev.type}${msg}`;
    eventsEl.appendChild(row);
  }
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

function summarizeObserve(state) {
  return {
    url: state.url,
    title: state.title,
    pageHint: state.pageHint,
    fingerprint: state.fingerprint,
    signalCount: state.signals?.length ?? 0,
    buttons: state.buttons?.slice(0, 6),
    dialogs: state.dialogs,
  };
}

daemonInput.value = await getDaemon();

const session = await chrome.storage.session.get(["lastObserve", "lastEvents"]);
if (session.lastObserve?.signals) renderSignals(session.lastObserve.signals);
if (session.lastEvents?.length) renderEvents(session.lastEvents);

document.getElementById("ping").onclick = async () => {
  try {
    const health = await api("/health");
    const info = await api("/extension/info");
    show({ health, info }, true);
  } catch (error) {
    show(error instanceof Error ? error.message : String(error), false);
  }
};

document.getElementById("status").onclick = async () => {
  try {
    show(await api("/status"), true);
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
    renderSignals(result.state?.signals);
    show(
      {
        attached: result.ok,
        ...summarizeObserve(result.state ?? {}),
      },
      true,
    );
    await chrome.storage.session.set({ lastObserve: result.state });
  } catch (error) {
    show(error instanceof Error ? error.message : String(error), false);
  }
};

document.getElementById("observe").onclick = async () => {
  try {
    const state = await api("/observe");
    renderSignals(state.signals);
    show(summarizeObserve(state), true);
    await chrome.storage.session.set({ lastObserve: state });
  } catch (error) {
    show(error instanceof Error ? error.message : String(error), false);
  }
};

document.getElementById("diff").onclick = async () => {
  try {
    const data = await api("/diff");
    if (data.state?.signals) renderSignals(data.state.signals);
    show(
      {
        diff: data.diff,
        state: summarizeObserve(data.state ?? {}),
      },
      true,
    );
  } catch (error) {
    show(error instanceof Error ? error.message : String(error), false);
  }
};

document.getElementById("events-btn").onclick = async () => {
  try {
    const data = await api("/events?limit=12");
    const events = data.events ?? data;
    const list = Array.isArray(events) ? events : [];
    renderEvents(list);
    show({ events: list }, true);
    await chrome.storage.session.set({ lastEvents: list });
  } catch (error) {
    show(error instanceof Error ? error.message : String(error), false);
  }
};

document.getElementById("dismiss").onclick = async () => {
  try {
    const result = await api("/act", {
      method: "POST",
      body: JSON.stringify({ action: { type: "dismiss_overlays" } }),
    });
    if (result.state?.signals) renderSignals(result.state.signals);
    show(
      {
        ok: result.ok,
        error: result.error,
        state: summarizeObserve(result.state ?? {}),
      },
      result.ok !== false,
    );
    if (result.state) await chrome.storage.session.set({ lastObserve: result.state });
  } catch (error) {
    show(error instanceof Error ? error.message : String(error), false);
  }
};
