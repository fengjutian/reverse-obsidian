export const IPC_CHANNELS = {
  vaultListNotes: "vault:list-notes",
  noteRead: "note:read",
  noteWrite: "note:write",
  noteRender: "note:render",
  noteBacklinks: "note:backlinks",
  searchQuery: "search:query"
} as const;

export interface DesktopApi {
  listNotes(): Promise<string[]>;
  readNote(path: string): Promise<string>;
  writeNote(path: string, content: string): Promise<void>;
  renderNote(markdown: string): Promise<string>;
  getBacklinks(path: string): Promise<string[]>;
  search(keyword: string, limit?: number): Promise<
    Array<{
      path: string;
      title: string;
      score: number;
      snippet: string;
    }>
  >;
}

