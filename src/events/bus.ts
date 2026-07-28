export type RuntimeEventType =
  | "attached"
  | "detached"
  | "observe"
  | "dom_change"
  | "run_start"
  | "run_end"
  | "step_start"
  | "step_end"
  | "recovery"
  | "policy"
  | "error";

export interface RuntimeEvent {
  id: number;
  type: RuntimeEventType;
  at: string;
  message?: string;
  data?: Record<string, unknown>;
}

type Listener = (event: RuntimeEvent) => void;

/**
 * Lightweight in-process event bus with a recent ring buffer.
 * Agents can poll GET /events or stream GET /events/stream (SSE).
 */
export class EventBus {
  private seq = 0;
  private readonly recent: RuntimeEvent[] = [];
  private readonly listeners = new Set<Listener>();

  constructor(private readonly maxRecent = 250) {}

  emit(
    type: RuntimeEventType,
    data?: Record<string, unknown>,
    message?: string,
  ): RuntimeEvent {
    const event: RuntimeEvent = {
      id: ++this.seq,
      type,
      at: new Date().toISOString(),
      message,
      data,
    };
    this.recent.push(event);
    if (this.recent.length > this.maxRecent) {
      this.recent.splice(0, this.recent.length - this.maxRecent);
    }
    for (const listener of this.listeners) {
      try {
        listener(event);
      } catch {
        // never let a subscriber break the runtime
      }
    }
    return event;
  }

  on(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  list(options: { afterId?: number; limit?: number; type?: string } = {}): RuntimeEvent[] {
    let items = this.recent;
    if (typeof options.afterId === "number") {
      items = items.filter((e) => e.id > options.afterId!);
    }
    if (options.type) {
      items = items.filter((e) => e.type === options.type);
    }
    const limit = options.limit ?? 100;
    return items.slice(-limit);
  }

  clear(): void {
    this.recent.length = 0;
  }
}
