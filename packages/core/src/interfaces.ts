import type { SearchResult } from "@ekm/shared-types";

export interface VaultManager {
  open(workspacePath: string): Promise<void>;
  listNotes(): Promise<string[]>;
  readNote(path: string): Promise<string>;
  writeNote(path: string, content: string): Promise<void>;
}

export interface LinkIndex {
  rebuild(): Promise<void>;
  updateByPath(path: string): Promise<void>;
  getBacklinks(path: string): Promise<string[]>;
}

export interface SearchEngine {
  query(keyword: string, limit?: number): Promise<SearchResult[]>;
}
