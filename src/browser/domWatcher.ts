import type { BrowserContext, Page } from "playwright";

export interface DomMutationBatch {
  mutations: number;
  addedNodes: number;
  removedNodes: number;
  attributeChanges: number;
  timestamp: number;
  url?: string;
}

const exposedContexts = new WeakSet<BrowserContext>();

/**
 * Plain browser script (no TS compile artifacts). Installs MutationObserver + debounced notify.
 */
export const DOM_OBSERVER_BOOTSTRAP = `
(() => {
  const w = window;
  function install() {
    if (w.__berDomObserver) w.__berDomObserver.disconnect();
    let scheduled = false;
    let pending = { mutations: 0, addedNodes: 0, removedNodes: 0, attributeChanges: 0 };
    const flush = () => {
      scheduled = false;
      const batch = Object.assign({}, pending, { timestamp: Date.now(), url: location.href });
      pending = { mutations: 0, addedNodes: 0, removedNodes: 0, attributeChanges: 0 };
      const fn = w.__berDomMutation;
      if (typeof fn === "function") fn(batch).catch(() => undefined);
    };
    const schedule = () => {
      if (scheduled) return;
      scheduled = true;
      setTimeout(flush, 250);
    };
    const observer = new MutationObserver((records) => {
      for (let i = 0; i < records.length; i++) {
        const r = records[i];
        pending.mutations += 1;
        pending.addedNodes += r.addedNodes.length;
        pending.removedNodes += r.removedNodes.length;
        if (r.type === "attributes") pending.attributeChanges += 1;
      }
      schedule();
    });
    const target = document.documentElement || document.body;
    if (target) {
      observer.observe(target, {
        subtree: true,
        childList: true,
        attributes: true,
        characterData: true,
      });
    }
    w.__berDomObserver = observer;
  }
  w.__berInstallDomObserver = install;
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", install, { once: true });
  } else {
    install();
  }
})();
`;

export function domWatchEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  const v = env.BER_DOM_WATCH;
  if (v === "0" || v === "false") return false;
  return true;
}

export function resolveDomWatchDebounceMs(env: NodeJS.ProcessEnv = process.env): number {
  const raw = env.BER_DOM_WATCH_DEBOUNCE_MS;
  if (!raw) return 400;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) && n >= 0 ? n : 400;
}

export function mergeDomBatches(a: DomMutationBatch, b: DomMutationBatch): DomMutationBatch {
  return {
    mutations: a.mutations + b.mutations,
    addedNodes: a.addedNodes + b.addedNodes,
    removedNodes: a.removedNodes + b.removedNodes,
    attributeChanges: a.attributeChanges + b.attributeChanges,
    timestamp: b.timestamp,
    url: b.url ?? a.url,
  };
}

/**
 * In-page MutationObserver → debounced bursts on the Node event bus.
 * Disable with BER_DOM_WATCH=0.
 */
export class DomMutationWatcher {
  private page: Page | null = null;
  private nodeTimer: ReturnType<typeof setTimeout> | null = null;
  private pending: DomMutationBatch | null = null;
  private readonly debounceMs: number;
  private readonly env: NodeJS.ProcessEnv;

  constructor(
    private readonly onBurst: (batch: DomMutationBatch) => void,
    options?: { debounceMs?: number; env?: NodeJS.ProcessEnv },
  ) {
    const env = options?.env ?? process.env;
    this.debounceMs = options?.debounceMs ?? resolveDomWatchDebounceMs(env);
    this.env = env;
  }

  async watch(page: Page): Promise<void> {
    if (!domWatchEnabled(this.env)) return;
    await this.unwatch();
    this.page = page;
    const context = page.context();
    if (!exposedContexts.has(context)) {
      await context.exposeFunction("__berDomMutation", (batch: DomMutationBatch) => {
        this.ingest(batch);
      });
      await context.addInitScript({ content: DOM_OBSERVER_BOOTSTRAP });
      exposedContexts.add(context);
    }
    await page.evaluate(DOM_OBSERVER_BOOTSTRAP);
  }

  async unwatch(): Promise<void> {
    if (this.nodeTimer) {
      clearTimeout(this.nodeTimer);
      this.nodeTimer = null;
    }
    this.pending = null;
    const page = this.page;
    this.page = null;
    if (page && !page.isClosed()) {
      await page
        .evaluate(() => {
          const w = window as Window & { __berDomObserver?: MutationObserver };
          w.__berDomObserver?.disconnect();
        })
        .catch(() => undefined);
    }
  }

  private ingest(batch: DomMutationBatch): void {
    if (!domWatchEnabled(this.env)) return;
    this.pending = this.pending ? mergeDomBatches(this.pending, batch) : batch;
    if (this.nodeTimer) clearTimeout(this.nodeTimer);
    this.nodeTimer = setTimeout(() => this.flush(), this.debounceMs);
  }

  private flush(): void {
    this.nodeTimer = null;
    const batch = this.pending;
    this.pending = null;
    if (!batch || batch.mutations <= 0) return;
    this.onBurst(batch);
  }
}
