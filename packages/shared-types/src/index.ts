export type NotePath = string;

export interface NoteMeta {
  id: string;
  path: NotePath;
  title: string;
  hash: string;
  createdAt: string;
  updatedAt: string;
}

export interface SearchResult {
  path: NotePath;
  title: string;
  score: number;
  snippet: string;
}

export interface LinkEdge {
  sourcePath: NotePath;
  targetPath: NotePath;
  alias?: string;
  isEmbed: boolean;
}

export interface GraphNode {
  id: string;
  label: string;
  type: "note" | "tag" | "attachment";
}

export interface GraphEdge {
  id: string;
  source: string;
  target: string;
  type: "reference" | "embed" | "tagged";
}

export interface GraphData {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

// ── Plugin System ──────────────────────────────────────────────────────────

export interface PluginManifest {
  id: string;
  name: string;
  version: string;
  description?: string;
  author?: string;
  /** Minimum EKM app version required */
  minAppVersion: string;
  /** Declared capability permissions */
  permissions?: Array<"file" | "network" | "clipboard">;
}

// ── IPC Channels ──────────────────────────────────────────────────────────

export type IpcChannel =
  | "vault:open"
  | "vault:close"
  | "vault:list-recent"
  | "note:read"
  | "note:write"
  | "note:delete"
  | "note:list"
  | "note:rename"
  | "search:query"
  | "search:index-rebuild"
  | "plugin:load"
  | "plugin:unload"
  | "plugin:list"
  | "sync:status"
  | "sync:push"
  | "sync:pull";

// ── Vault Configuration ───────────────────────────────────────────────────

/** Stored in <vault>/.ekm/config.json */
export interface VaultConfig {
  version: string;
  name: string;
  /** ISO 8601 date string */
  createdAt: string;
  /** Default folder for daily notes */
  dailyNotesFolder?: string;
  /** Date format for daily notes, e.g. "YYYY-MM-DD" */
  dailyNotesFormat?: string;
  /** Folder containing template files */
  templatesFolder?: string;
  /** Folders excluded from indexing */
  excludedFolders?: string[];
}

// ── Workspace State ───────────────────────────────────────────────────────

export interface TabState {
  path: NotePath;
  scrollTop: number;
  /** Cursor offset in the document */
  cursorOffset?: number;
}

export interface PaneState {
  tabs: TabState[];
  activeTabIndex: number;
}

/** Stored in <vault>/.ekm/workspace.json */
export interface WorkspaceState {
  version: string;
  /** Split layout: "single" | "horizontal" | "vertical" */
  layout: "single" | "horizontal" | "vertical";
  panes: PaneState[];
  /** ISO 8601 date string of last save */
  savedAt: string;
}
