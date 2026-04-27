import Database from "better-sqlite3";
import { existsSync, unlinkSync } from "fs";
import { randomUUID } from "crypto";

export class VaultDatabase {
  private db: Database.Database | null = null;

  constructor(private readonly dbPath: string) {}

  open(): void {
    this.db = new Database(this.dbPath);
    this.db.pragma("journal_mode = WAL");
    this.db.pragma("foreign_keys = ON");

    // Integrity check — rebuild if corrupted
    const rows = this.db.pragma("integrity_check") as Array<{ integrity_check: string }>;
    const isOk = rows.length === 1 && rows[0].integrity_check === "ok";
    if (!isOk) {
      this.db.close();
      this.db = null;
      if (existsSync(this.dbPath)) {
        unlinkSync(this.dbPath);
      }
      this.db = new Database(this.dbPath);
      this.db.pragma("journal_mode = WAL");
      this.db.pragma("foreign_keys = ON");
    }

    this._migrate();
  }

  close(): void {
    this.db?.close();
    this.db = null;
  }

  private get conn(): Database.Database {
    if (!this.db) throw new Error("Database is not open");
    return this.db;
  }

  private _migrate(): void {
    this.conn.exec(`
      CREATE TABLE IF NOT EXISTS notes (
        id TEXT PRIMARY KEY,
        workspace_id TEXT NOT NULL,
        path TEXT NOT NULL UNIQUE,
        title TEXT NOT NULL,
        hash TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS links (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        workspace_id TEXT NOT NULL,
        source_path TEXT NOT NULL,
        target_path TEXT NOT NULL,
        relation TEXT NOT NULL DEFAULT 'reference',
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS tags (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        workspace_id TEXT NOT NULL,
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
    const stmt = this.conn.prepare(`
      INSERT INTO notes (id, workspace_id, path, title, hash, updated_at)
      VALUES (@id, @workspaceId, @path, @title, @hash, datetime('now'))
      ON CONFLICT(path) DO UPDATE SET
        title = excluded.title,
        hash = excluded.hash,
        updated_at = excluded.updated_at
    `);
    this.transaction(() => stmt.run({ id: randomUUID(), ...meta }));
  }

  deleteNote(path: string): void {
    const stmt = this.conn.prepare("DELETE FROM notes WHERE path = ?");
    this.transaction(() => stmt.run(path));
  }

  // ── Links ──────────────────────────────────────────────────────────────────

  upsertLinks(sourcePath: string, links: Array<{ targetPath: string; relation: string }>): void {
    const del = this.conn.prepare("DELETE FROM links WHERE source_path = ?");
    const ins = this.conn.prepare(
      "INSERT INTO links (workspace_id, source_path, target_path, relation) VALUES ('', ?, ?, ?)"
    );
    this.transaction(() => {
      del.run(sourcePath);
      for (const link of links) {
        ins.run(sourcePath, link.targetPath, link.relation);
      }
    });
  }

  deleteLinks(sourcePath: string): void {
    const stmt = this.conn.prepare("DELETE FROM links WHERE source_path = ?");
    this.transaction(() => stmt.run(sourcePath));
  }

  getBacklinks(targetPath: string): string[] {
    const rows = this.conn
      .prepare("SELECT source_path FROM links WHERE target_path = ?")
      .all(targetPath) as Array<{ source_path: string }>;
    return rows.map((r) => r.source_path);
  }

  getAllLinks(): Array<{ sourcePath: string; targetPath: string; relation: string }> {
    const rows = this.conn
      .prepare("SELECT source_path, target_path, relation FROM links")
      .all() as Array<{ source_path: string; target_path: string; relation: string }>;
    return rows.map((r) => ({
      sourcePath: r.source_path,
      targetPath: r.target_path,
      relation: r.relation,
    }));
  }

  // ── Tags ───────────────────────────────────────────────────────────────────

  upsertTags(notePath: string, tags: string[]): void {
    const noteRow = this.conn
      .prepare("SELECT id, workspace_id FROM notes WHERE path = ?")
      .get(notePath) as { id: string; workspace_id: string } | undefined;
    if (!noteRow) return;

    const delNT = this.conn.prepare("DELETE FROM note_tags WHERE note_id = ?");
    const insTag = this.conn.prepare(
      "INSERT OR IGNORE INTO tags (workspace_id, name) VALUES (?, ?)"
    );
    const getTag = this.conn.prepare(
      "SELECT id FROM tags WHERE workspace_id = ? AND name = ?"
    );
    const insNT = this.conn.prepare(
      "INSERT OR IGNORE INTO note_tags (note_id, tag_id) VALUES (?, ?)"
    );

    this.transaction(() => {
      delNT.run(noteRow.id);
      for (const tag of tags) {
        insTag.run(noteRow.workspace_id, tag);
        const tagRow = getTag.get(noteRow.workspace_id, tag) as { id: number };
        insNT.run(noteRow.id, tagRow.id);
      }
    });
  }

  // ── Index state ────────────────────────────────────────────────────────────

  getIndexState(workspaceId: string): { lastScanAt: string; lastEventId: string } | null {
    const row = this.conn
      .prepare("SELECT last_scan_at, last_event_id FROM index_state WHERE workspace_id = ?")
      .get(workspaceId) as { last_scan_at: string; last_event_id: string } | undefined;
    if (!row) return null;
    return { lastScanAt: row.last_scan_at, lastEventId: row.last_event_id };
  }

  setIndexState(workspaceId: string, lastScanAt: string, lastEventId: string): void {
    const stmt = this.conn.prepare(`
      INSERT INTO index_state (workspace_id, last_scan_at, last_event_id)
      VALUES (?, ?, ?)
      ON CONFLICT(workspace_id) DO UPDATE SET
        last_scan_at = excluded.last_scan_at,
        last_event_id = excluded.last_event_id
    `);
    this.transaction(() => stmt.run(workspaceId, lastScanAt, lastEventId));
  }

  // ── Transaction helper ─────────────────────────────────────────────────────

  transaction<T>(fn: () => T): T {
    return this.conn.transaction(fn)();
  }
}
