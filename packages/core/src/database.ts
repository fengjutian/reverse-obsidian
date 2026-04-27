import { existsSync, readFileSync, writeFileSync, unlinkSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { randomUUID } from "node:crypto";
import { createRequire } from "node:module";

// sql.js is a CJS module — use createRequire for ESM compatibility
const require = createRequire(import.meta.url);
// eslint-disable-next-line @typescript-eslint/no-require-imports
const initSqlJs = require("sql.js") as (config?: object) => Promise<{ Database: new (data?: Buffer | Uint8Array) => SqlJsDb }>;

interface SqlJsDb {
  run(sql: string, params?: unknown[]): void;
  exec(sql: string, params?: unknown[]): Array<{ columns: string[]; values: unknown[][] }>;
  export(): Uint8Array;
  close(): void;
}

/**
 * VaultDatabase — local SQLite metadata store backed by sql.js (pure WASM).
 * No native compilation required.
 */
export class VaultDatabase {
  private db: SqlJsDb | null = null;

  constructor(private readonly dbPath: string) {}

  /** Open (or create) the database, run integrity check, apply migrations. */
  async open(): Promise<void> {
    const SQL = await initSqlJs();

    let data: Buffer | undefined;
    if (existsSync(this.dbPath)) {
      data = readFileSync(this.dbPath);
    }

    try {
      this.db = new SQL.Database(data);
    } catch {
      // Corrupted — delete and recreate
      if (existsSync(this.dbPath)) unlinkSync(this.dbPath);
      this.db = new SQL.Database();
    }

    // Integrity check
    const result = this.db.exec("PRAGMA integrity_check");
    const ok = result[0]?.values?.[0]?.[0] === "ok";
    if (!ok) {
      this.db.close();
      if (existsSync(this.dbPath)) unlinkSync(this.dbPath);
      this.db = new SQL.Database();
    }

    this._migrate();
    this._persist();
  }

  close(): void {
    if (this.db) {
      this._persist();
      this.db.close();
      this.db = null;
    }
  }

  private get conn(): SqlJsDb {
    if (!this.db) throw new Error("Database is not open. Call open() first.");
    return this.db;
  }

  private _persist(): void {
    if (!this.db) return;
    const data = this.db.export();
    mkdirSync(dirname(this.dbPath), { recursive: true });
    writeFileSync(this.dbPath, Buffer.from(data));
  }

  private _migrate(): void {
    this.conn.run(`
      CREATE TABLE IF NOT EXISTS notes (
        id TEXT PRIMARY KEY,
        workspace_id TEXT NOT NULL DEFAULT '',
        path TEXT NOT NULL UNIQUE,
        title TEXT NOT NULL,
        hash TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
      CREATE TABLE IF NOT EXISTS links (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        workspace_id TEXT NOT NULL DEFAULT '',
        source_path TEXT NOT NULL,
        target_path TEXT NOT NULL,
        relation TEXT NOT NULL DEFAULT 'reference',
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
      CREATE TABLE IF NOT EXISTS tags (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        workspace_id TEXT NOT NULL DEFAULT '',
        name TEXT NOT NULL,
        UNIQUE(workspace_id, name)
      );
      CREATE TABLE IF NOT EXISTS note_tags (
        note_id TEXT NOT NULL,
        tag_id INTEGER NOT NULL,
        PRIMARY KEY (note_id, tag_id)
      );
      CREATE TABLE IF NOT EXISTS embeddings (
        note_id TEXT PRIMARY KEY,
        vector BLOB NOT NULL,
        model TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
      CREATE TABLE IF NOT EXISTS index_state (
        workspace_id TEXT PRIMARY KEY,
        last_scan_at TEXT NOT NULL,
        last_event_id TEXT NOT NULL DEFAULT ''
      );
    `);
  }

  // ── Notes ──────────────────────────────────────────────────────────────────

  upsertNote(meta: { path: string; title: string; hash: string; workspaceId: string }): void {
    this.conn.run(
      `INSERT INTO notes (id, workspace_id, path, title, hash, updated_at)
       VALUES (?, ?, ?, ?, ?, datetime('now'))
       ON CONFLICT(path) DO UPDATE SET title=excluded.title, hash=excluded.hash, updated_at=excluded.updated_at`,
      [randomUUID(), meta.workspaceId, meta.path, meta.title, meta.hash]
    );
    this._persist();
  }

  deleteNote(path: string): void {
    this.conn.run("DELETE FROM notes WHERE path = ?", [path]);
    this._persist();
  }

  // ── Links ──────────────────────────────────────────────────────────────────

  upsertLinks(sourcePath: string, links: Array<{ targetPath: string; relation: string }>): void {
    this.conn.run("DELETE FROM links WHERE source_path = ?", [sourcePath]);
    for (const link of links) {
      this.conn.run(
        "INSERT INTO links (workspace_id, source_path, target_path, relation) VALUES ('', ?, ?, ?)",
        [sourcePath, link.targetPath, link.relation]
      );
    }
    this._persist();
  }

  deleteLinks(sourcePath: string): void {
    this.conn.run("DELETE FROM links WHERE source_path = ?", [sourcePath]);
    this._persist();
  }

  getBacklinks(targetPath: string): string[] {
    const result = this.conn.exec("SELECT source_path FROM links WHERE target_path = ?", [targetPath]);
    return (result[0]?.values ?? []).map((row) => row[0] as string);
  }

  getAllLinks(): Array<{ sourcePath: string; targetPath: string; relation: string }> {
    const result = this.conn.exec("SELECT source_path, target_path, relation FROM links");
    return (result[0]?.values ?? []).map((row) => ({
      sourcePath: row[0] as string,
      targetPath: row[1] as string,
      relation: row[2] as string,
    }));
  }

  // ── Index state ────────────────────────────────────────────────────────────

  getIndexState(workspaceId: string): { lastScanAt: string; lastEventId: string } | null {
    const result = this.conn.exec(
      "SELECT last_scan_at, last_event_id FROM index_state WHERE workspace_id = ?",
      [workspaceId]
    );
    const row = result[0]?.values?.[0];
    if (!row) return null;
    return { lastScanAt: row[0] as string, lastEventId: row[1] as string };
  }

  setIndexState(workspaceId: string, lastScanAt: string, lastEventId: string): void {
    this.conn.run(
      `INSERT INTO index_state (workspace_id, last_scan_at, last_event_id) VALUES (?, ?, ?)
       ON CONFLICT(workspace_id) DO UPDATE SET last_scan_at=excluded.last_scan_at, last_event_id=excluded.last_event_id`,
      [workspaceId, lastScanAt, lastEventId]
    );
    this._persist();
  }

  // ── Transaction helper ─────────────────────────────────────────────────────

  transaction<T>(fn: () => T): T {
    this.conn.run("BEGIN");
    try {
      const result = fn();
      this.conn.run("COMMIT");
      this._persist();
      return result;
    } catch (err) {
      this.conn.run("ROLLBACK");
      throw err;
    }
  }
}
