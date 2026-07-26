import type { SemanticState } from "../types.js";

/**
 * Memory hierarchy (as decided):
 * L1 — RAM session cache (this class)
 * L2 — SQLite experience store (ExperienceStore)
 * L3 — local hashing embeddings + cosine similarity (ExperienceStore)
 */
export class SessionMemory {
  private state?: SemanticState;
  private recentActions: string[] = [];
  private checkpoints = new Map<string, unknown>();

  setState(state: SemanticState): void {
    this.state = state;
  }

  getState(): SemanticState | undefined {
    return this.state;
  }

  pushAction(label: string): void {
    this.recentActions.push(label);
    if (this.recentActions.length > 100) {
      this.recentActions = this.recentActions.slice(-100);
    }
  }

  recent(): string[] {
    return [...this.recentActions];
  }

  saveCheckpoint(id: string, payload: unknown): void {
    this.checkpoints.set(id, payload);
  }

  loadCheckpoint<T = unknown>(id: string): T | undefined {
    return this.checkpoints.get(id) as T | undefined;
  }

  clear(): void {
    this.state = undefined;
    this.recentActions = [];
    this.checkpoints.clear();
  }
}
