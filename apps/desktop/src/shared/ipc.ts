export const IPC_CHANNELS = {
  vaultListNotes: "vault:list-notes",
  vaultOpen: "vault:open",
  vaultClose: "vault:close",
  vaultListRecent: "vault:list-recent",
  noteRead: "note:read",
  noteWrite: "note:write",
  noteDelete: "note:delete",
  noteRender: "note:render",
  noteBacklinks: "note:backlinks",
  searchQuery: "search:query"
} as const;

export interface DesktopApi {
  // vault:*
  openVault(path: string): Promise<void>;
  closeVault(): Promise<void>;
  listRecentVaults(): Promise<string[]>;
  listNotes(): Promise<string[]>;
  // note:*
  readNote(path: string): Promise<string>;
  writeNote(path: string, content: string): Promise<void>;
  deleteNote(path: string): Promise<void>;
  renderNote(markdown: string): Promise<string>;
  getBacklinks(path: string): Promise<string[]>;
  // search:*
  search(keyword: string, limit?: number): Promise<
    Array<{
      path: string;
      title: string;
      score: number;
      snippet: string;
    }>
  >;
}


