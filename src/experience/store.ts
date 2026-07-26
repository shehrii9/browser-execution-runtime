import Database from "better-sqlite3";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import {
  bufferToVector,
  cosineSimilarity,
  embedExperience,
  vectorToBuffer,
} from "../memory/embeddings.js";
import type { Action, ExperienceRecord } from "../types.js";

export interface RememberInput {
  site: string;
  goal: string;
  stateHash: string;
  problem: string;
  fix: Action[];
  success?: boolean;
  pageHint?: string;
  signals?: string[];
}

export interface FindBestInput {
  site: string;
  stateHash: string;
  problem: string;
  minConfidence: number;
  pageHint?: string;
  signals?: string[];
  goal?: string;
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
        created_at TEXT NOT NULL,
        page_hint TEXT NOT NULL DEFAULT '',
        signals_json TEXT NOT NULL DEFAULT '[]',
        times_used INTEGER NOT NULL DEFAULT 0,
        embedding BLOB
      );
      CREATE INDEX IF NOT EXISTS idx_exp_lookup
        ON experiences(site, state_hash, problem);
      CREATE INDEX IF NOT EXISTS idx_exp_site_problem
        ON experiences(site, problem);
    `);
    this.migrate();
  }

  private migrate(): void {
    const cols = this.db.prepare(`PRAGMA table_info(experiences)`).all() as Array<{
      name: string;
    }>;
    const names = new Set(cols.map((c) => c.name));
    if (!names.has("page_hint")) {
      this.db.exec(`ALTER TABLE experiences ADD COLUMN page_hint TEXT NOT NULL DEFAULT ''`);
    }
    if (!names.has("signals_json")) {
      this.db.exec(`ALTER TABLE experiences ADD COLUMN signals_json TEXT NOT NULL DEFAULT '[]'`);
    }
    if (!names.has("times_used")) {
      this.db.exec(`ALTER TABLE experiences ADD COLUMN times_used INTEGER NOT NULL DEFAULT 0`);
    }
    if (!names.has("embedding")) {
      this.db.exec(`ALTER TABLE experiences ADD COLUMN embedding BLOB`);
    }
  }

  count(): number {
    const row = this.db.prepare("SELECT COUNT(*) AS c FROM experiences").get() as {
      c: number;
    };
    return row.c;
  }

  vectorCount(): number {
    const row = this.db
      .prepare(`SELECT COUNT(*) AS c FROM experiences WHERE embedding IS NOT NULL`)
      .get() as { c: number };
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

    const pageHint = input.pageHint ?? "";
    const signals = input.signals ?? [];
    const signalsJson = JSON.stringify(signals);
    const embedding = vectorToBuffer(
      embedExperience({
        site: input.site,
        problem: input.problem,
        pageHint,
        signals,
        goal: input.goal,
      }),
    );

    if (existing) {
      const success = existing.success + (input.success === false ? 0 : 1);
      const failure = existing.failure + (input.success === false ? 1 : 0);
      const confidence = success / Math.max(1, success + failure);
      this.db
        .prepare(
          `UPDATE experiences
           SET fix_json = ?, success = ?, failure = ?, confidence = ?, last_used = ?,
               page_hint = ?, signals_json = ?, times_used = times_used + 1,
               embedding = ?
           WHERE id = ?`,
        )
        .run(
          JSON.stringify(input.fix),
          success,
          failure,
          confidence,
          new Date().toISOString(),
          pageHint || existing.page_hint,
          signalsJson === "[]" ? existing.signals_json : signalsJson,
          embedding,
          existing.id,
        );
      return this.get(existing.id)!;
    }

    const createdAt = new Date().toISOString();
    const result = this.db
      .prepare(
        `INSERT INTO experiences
         (site, goal, state_hash, problem, fix_json, success, failure, confidence, last_used, created_at, page_hint, signals_json, times_used, embedding)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
        pageHint,
        signalsJson,
        input.success === false ? 0 : 1,
        embedding,
      );

    return this.get(Number(result.lastInsertRowid))!;
  }

  findBest(input: FindBestInput): ExperienceRecord | null {
    const exact = this.db
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
    if (exact) return mapRow(exact);

    const queryVec = embedExperience({
      site: input.site,
      problem: input.problem,
      pageHint: input.pageHint,
      signals: input.signals,
      goal: input.goal,
    });

    const candidates = this.db
      .prepare(
        `SELECT * FROM experiences
         WHERE confidence >= ?
         ORDER BY id DESC
         LIMIT 100`,
      )
      .all(input.minConfidence) as DbRow[];

    return pickBest(candidates, input, queryVec);
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
         SET success = ?, failure = ?, confidence = ?, last_used = ?,
             times_used = times_used + 1
         WHERE id = ?`,
      )
      .run(nextSuccess, nextFailure, confidence, new Date().toISOString(), id);
  }

  list(limit = 50): ExperienceRecord[] {
    const rows = this.db
      .prepare(`SELECT * FROM experiences ORDER BY id DESC LIMIT ?`)
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
  page_hint: string;
  signals_json: string;
  times_used: number;
  embedding: Buffer | null;
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
    pageHint: row.page_hint || undefined,
    signals: safeJsonArray(row.signals_json),
    timesUsed: row.times_used ?? 0,
  };
}

function safeJsonArray(raw: string): string[] {
  try {
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

function pickBest(
  rows: DbRow[],
  input: FindBestInput,
  queryVec: Float32Array,
): ExperienceRecord | null {
  if (rows.length === 0) return null;
  let best: { row: DbRow; score: number } | null = null;

  for (const row of rows) {
    const signals = safeJsonArray(row.signals_json);
    const overlap = jaccard(input.signals ?? [], signals);
    const pageBonus = input.pageHint && row.page_hint === input.pageHint ? 0.12 : 0;
    const sameSite = row.site === input.site ? 0.12 : 0;
    const sameProblem = row.problem === input.problem ? 0.18 : 0;

    let vectorScore = 0;
    if (row.embedding) {
      vectorScore = cosineSimilarity(queryVec, bufferToVector(row.embedding));
    }

    const score =
      row.confidence * 0.35 +
      vectorScore * 0.28 +
      overlap * 0.15 +
      sameProblem +
      sameSite +
      pageBonus +
      Math.min(0.08, (row.times_used ?? 0) * 0.01);

    if (!best || score > best.score) best = { row, score };
  }

  if (!best || best.score < Math.max(0.45, input.minConfidence * 0.65)) return null;
  return mapRow(best.row);
}

function jaccard(a: string[], b: string[]): number {
  if (a.length === 0 && b.length === 0) return 0.5;
  const aSet = new Set(a);
  const bSet = new Set(b);
  let inter = 0;
  for (const v of aSet) if (bSet.has(v)) inter += 1;
  const union = new Set([...aSet, ...bSet]).size || 1;
  return inter / union;
}
