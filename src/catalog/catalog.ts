import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { DatabaseSync } from "node:sqlite";

export interface CatalogSource {
  id: string;
  url: string;
  mode: string;
  quality_prior: number;
}

export interface CatalogCandidate {
  id: string;
  source_id: string;
  slot: string;
  payload: Record<string, unknown>;
}

export interface CatalogDecision {
  candidate_id: string;
  run_id: string;
  decision: "accepted" | "rejected";
  reason: string;
}

export interface DesignStory {
  id: string;
  signature: string;
  payload: Record<string, unknown>;
  score: number;
}

function parseJson(value: unknown): Record<string, unknown> {
  return JSON.parse(String(value)) as Record<string, unknown>;
}

export class Catalog {
  private readonly database: DatabaseSync;

  constructor(path: string) {
    mkdirSync(dirname(path), { recursive: true });
    this.database = new DatabaseSync(path);
    this.database.exec(`
      PRAGMA journal_mode = WAL;
      CREATE TABLE IF NOT EXISTS sources (
        id TEXT PRIMARY KEY, url TEXT NOT NULL, mode TEXT NOT NULL,
        quality_prior INTEGER NOT NULL, updated_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS candidates (
        id TEXT PRIMARY KEY, source_id TEXT NOT NULL, slot TEXT NOT NULL,
        payload TEXT NOT NULL, updated_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS decisions (
        id INTEGER PRIMARY KEY AUTOINCREMENT, candidate_id TEXT NOT NULL,
        run_id TEXT NOT NULL, decision TEXT NOT NULL, reason TEXT NOT NULL,
        created_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS stories (
        id TEXT PRIMARY KEY, signature TEXT NOT NULL, payload TEXT NOT NULL,
        score REAL NOT NULL, updated_at TEXT NOT NULL
      );
    `);
  }

  upsertSource(source: CatalogSource): void {
    this.database.prepare(`
      INSERT INTO sources (id, url, mode, quality_prior, updated_at)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET url=excluded.url, mode=excluded.mode,
        quality_prior=excluded.quality_prior, updated_at=excluded.updated_at
    `).run(source.id, source.url, source.mode, source.quality_prior, new Date().toISOString());
  }

  getSource(id: string): CatalogSource | undefined {
    return this.database.prepare("SELECT id, url, mode, quality_prior FROM sources WHERE id = ?").get(id) as CatalogSource | undefined;
  }

  listSources(): CatalogSource[] {
    return this.database.prepare("SELECT id, url, mode, quality_prior FROM sources ORDER BY id").all() as unknown as CatalogSource[];
  }

  upsertCandidate(candidate: CatalogCandidate): void {
    this.database.prepare(`
      INSERT INTO candidates (id, source_id, slot, payload, updated_at)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET source_id=excluded.source_id, slot=excluded.slot,
        payload=excluded.payload, updated_at=excluded.updated_at
    `).run(candidate.id, candidate.source_id, candidate.slot, JSON.stringify(candidate.payload), new Date().toISOString());
  }

  getCandidate(id: string): CatalogCandidate | undefined {
    const row = this.database.prepare("SELECT id, source_id, slot, payload FROM candidates WHERE id = ?").get(id) as
      | { id: string; source_id: string; slot: string; payload: string }
      | undefined;
    return row ? { ...row, payload: parseJson(row.payload) } : undefined;
  }

  recordDecision(decision: CatalogDecision): void {
    this.database.prepare(`
      INSERT INTO decisions (candidate_id, run_id, decision, reason, created_at)
      VALUES (?, ?, ?, ?, ?)
    `).run(decision.candidate_id, decision.run_id, decision.decision, decision.reason, new Date().toISOString());
  }

  listDecisions(runId: string): CatalogDecision[] {
    return this.database.prepare(`
      SELECT candidate_id, run_id, decision, reason FROM decisions
      WHERE run_id = ? ORDER BY id
    `).all(runId) as unknown as CatalogDecision[];
  }

  recordStory(story: DesignStory): void {
    this.database.prepare(`
      INSERT INTO stories (id, signature, payload, score, updated_at)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET signature=excluded.signature,
        payload=excluded.payload, score=excluded.score, updated_at=excluded.updated_at
    `).run(story.id, story.signature, JSON.stringify(story.payload), story.score, new Date().toISOString());
  }

  findSimilarStories(signature: string, limit: number): DesignStory[] {
    const terms = new Set(signature.toLowerCase().split(/\s+/).filter(Boolean));
    const rows = this.database.prepare("SELECT id, signature, payload, score FROM stories").all() as unknown as Array<{
      id: string;
      signature: string;
      payload: string;
      score: number;
    }>;
    return rows
      .map((row) => ({
        ...row,
        payload: parseJson(row.payload),
        overlap: row.signature.toLowerCase().split(/\s+/).filter((term) => terms.has(term)).length,
      }))
      .filter((row) => row.overlap > 0)
      .sort((a, b) => b.overlap - a.overlap || b.score - a.score || a.id.localeCompare(b.id))
      .slice(0, limit)
      .map(({ overlap: _overlap, ...row }) => row);
  }

  close(): void {
    this.database.close();
  }
}
