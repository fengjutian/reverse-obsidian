import type { SearchResult, WorkspaceState } from "@ekm/shared-types";

export interface VaultManager {
  open(workspacePath: string): Promise<void>;
  listNotes(): Promise<string[]>;
  readNote(path: string): Promise<string>;
  writeNote(path: string, content: string): Promise<void>;
  deleteNote(path: string): Promise<void>;
  renameNote(oldPath: string, newPath: string): Promise<void>;
  saveWorkspaceState(state: WorkspaceState): Promise<void>;
  loadWorkspaceState(): Promise<WorkspaceState | null>;
}


export interface LinkIndex {
  rebuild(): Promise<void>;
  updateByPath(path: string): Promise<void>;
  getBacklinks(path: string): Promise<string[]>;
}

export interface SearchEngine {
  query(keyword: string, limit?: number): Promise<SearchResult[]>;
}
