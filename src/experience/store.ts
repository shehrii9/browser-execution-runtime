import Database from "better-sqlite3";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import type { Action, ExperienceRecord } from "../types.js";

export interface RememberInput {
  site: string;
  goal: string;
  stateHash: string;
  problem: string;
  fix: Action[];
  success?: boolean;
}

export class ExperienceStore {
  private readonly db: Database.Database;

  constructor(dbPath: string) {
    mkdirSync(dirname(dbPath), { recursive: true });
    this.db = new Database(dbPath);
    this.db.pragma("journal_mode = WAL");
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS experiences (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        site TEXT NOT NULL,
        goal TEXT NOT NULL,
        state_hash TEXT NOT NULL,
        problem TEXT NOT NULL,
        fix_json TEXT NOT NULL,
        success INTEGER NOT NULL DEFAULT 1,
        failure INTEGER NOT NULL DEFAULT 0,
        confidence REAL NOT NULL DEFAULT 1.0,
        last_used TEXT,
        created_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_exp_lookup
        ON experiences(site, state_hash, problem);
    `);
  }

  count(): number {
    const row = this.db.prepare("SELECT COUNT(*) AS c FROM experiences").get() as {
      c: number;
    };
    return row.c;
  }

  remember(input: RememberInput): ExperienceRecord {
    const existing = this.db
      .prepare(
        `SELECT * FROM experiences
         WHERE site = ? AND state_hash = ? AND problem = ?
         ORDER BY id DESC LIMIT 1`,
      )
      .get(input.site, input.stateHash, input.problem) as DbRow | undefined;

    if (existing) {
      const success = existing.success + (input.success === false ? 0 : 1);
      const failure = existing.failure + (input.success === false ? 1 : 0);
      const confidence = success / Math.max(1, success + failure);
      this.db
        .prepare(
          `UPDATE experiences
           SET fix_json = ?, success = ?, failure = ?, confidence = ?, last_used = ?
           WHERE id = ?`,
        )
        .run(
          JSON.stringify(input.fix),
          success,
          failure,
          confidence,
          new Date().toISOString(),
          existing.id,
        );
      return this.get(existing.id)!;
    }

    const createdAt = new Date().toISOString();
    const result = this.db
      .prepare(
        `INSERT INTO experiences
         (site, goal, state_hash, problem, fix_json, success, failure, confidence, last_used, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        input.site,
        input.goal,
        input.stateHash,
        input.problem,
        JSON.stringify(input.fix),
        input.success === false ? 0 : 1,
        input.success === false ? 1 : 0,
        input.success === false ? 0 : 1,
        createdAt,
        createdAt,
      );

    return this.get(Number(result.lastInsertRowid))!;
  }

  findBest(input: {
    site: string;
    stateHash: string;
    problem: string;
    minConfidence: number;
  }): ExperienceRecord | null {
    const row = this.db
      .prepare(
        `SELECT * FROM experiences
         WHERE site = ?
           AND state_hash = ?
           AND problem = ?
           AND confidence >= ?
         ORDER BY confidence DESC, success DESC, id DESC
         LIMIT 1`,
      )
      .get(input.site, input.stateHash, input.problem, input.minConfidence) as
      | DbRow
      | undefined;

    if (row) return mapRow(row);

    // Fallback: same site + problem, ignore exact state hash.
    const soft = this.db
      .prepare(
        `SELECT * FROM experiences
         WHERE site = ?
           AND problem = ?
           AND confidence >= ?
         ORDER BY confidence DESC, success DESC, id DESC
         LIMIT 1`,
      )
      .get(input.site, input.problem, input.minConfidence) as DbRow | undefined;

    return soft ? mapRow(soft) : null;
  }

  markResult(id: number, success: boolean): void {
    const row = this.get(id);
    if (!row) return;
    const nextSuccess = row.success + (success ? 1 : 0);
    const nextFailure = row.failure + (success ? 0 : 1);
    const confidence = nextSuccess / Math.max(1, nextSuccess + nextFailure);
    this.db
      .prepare(
        `UPDATE experiences
         SET success = ?, failure = ?, confidence = ?, last_used = ?
         WHERE id = ?`,
      )
      .run(nextSuccess, nextFailure, confidence, new Date().toISOString(), id);
  }

  list(limit = 50): ExperienceRecord[] {
    const rows = this.db
      .prepare(
        `SELECT * FROM experiences ORDER BY id DESC LIMIT ?`,
      )
      .all(limit) as DbRow[];
    return rows.map(mapRow);
  }

  get(id: number): ExperienceRecord | null {
    const row = this.db.prepare(`SELECT * FROM experiences WHERE id = ?`).get(id) as
      | DbRow
      | undefined;
    return row ? mapRow(row) : null;
  }

  close(): void {
    this.db.close();
  }
}

interface DbRow {
  id: number;
  site: string;
  goal: string;
  state_hash: string;
  problem: string;
  fix_json: string;
  success: number;
  failure: number;
  confidence: number;
  last_used: string | null;
  created_at: string;
}

function mapRow(row: DbRow): ExperienceRecord {
  return {
    id: row.id,
    site: row.site,
    goal: row.goal,
    stateHash: row.state_hash,
    problem: row.problem,
    fix: JSON.parse(row.fix_json) as Action[],
    success: row.success,
    failure: row.failure,
    confidence: row.confidence,
    lastUsed: row.last_used,
    createdAt: row.created_at,
  };
}
