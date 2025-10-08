import Database from 'better-sqlite3';
import { env } from '../config/env.js';

export type JobStatus = 'pending' | 'processing' | 'completed' | 'failed';

export interface JobRecord {
  id: string;
  status: JobStatus;
  hash: string;
  createdAt: string;
  updatedAt: string;
  payload: Record<string, unknown>;
  result?: Record<string, unknown>;
  error?: string;
}

export class JobStore {
  private db: Database.Database;

  constructor() {
    this.db = new Database(env.JOB_DATABASE_PATH);
    this.db.pragma('journal_mode = WAL');
    this.db.prepare(`
      CREATE TABLE IF NOT EXISTS jobs (
        id TEXT PRIMARY KEY,
        status TEXT NOT NULL,
        hash TEXT NOT NULL,
        payload TEXT NOT NULL,
        result TEXT,
        error TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )
    `).run();
    this.db.prepare(`CREATE INDEX IF NOT EXISTS idx_jobs_hash ON jobs(hash)`).run();
  }

  upsertJob(record: JobRecord) {
    this.db
      .prepare(`
        INSERT INTO jobs (id, status, hash, payload, result, error, created_at, updated_at)
        VALUES (@id, @status, @hash, @payload, @result, @error, @createdAt, @updatedAt)
        ON CONFLICT(id) DO UPDATE SET
          status=excluded.status,
          hash=excluded.hash,
          payload=excluded.payload,
          result=excluded.result,
          error=excluded.error,
          updated_at=excluded.updated_at
      `)
      .run({
        ...record,
        payload: JSON.stringify(record.payload),
        result: record.result ? JSON.stringify(record.result) : null,
        error: record.error ?? null
      });
  }

  findByHash(hash: string): JobRecord | undefined {
    const row = this.db
      .prepare(`SELECT * FROM jobs WHERE hash = ? ORDER BY created_at DESC LIMIT 1`)
      .get(hash) as any;
    if (!row) return undefined;
    return this.mapRow(row);
  }

  findById(id: string): JobRecord | undefined {
    const row = this.db.prepare(`SELECT * FROM jobs WHERE id = ?`).get(id) as any;
    if (!row) return undefined;
    return this.mapRow(row);
  }

  private mapRow(row: any): JobRecord {
    return {
      id: row.id,
      status: row.status,
      hash: row.hash,
      payload: JSON.parse(row.payload),
      result: row.result ? JSON.parse(row.result) : undefined,
      error: row.error ?? undefined,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }
}

export const jobStore = new JobStore();
