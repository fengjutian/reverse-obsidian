export const IPC_CHANNELS = {
  vaultListNotes: "vault:list-notes",
  vaultOpen: "vault:open",
  vaultClose: "vault:close",
  vaultListRecent: "vault:list-recent",
  noteRead: "note:read",
  noteWrite: "note:write",
  noteDelete: "note:delete",
  noteRename: "note:rename",
  noteRender: "note:render",
  noteBacklinks: "note:backlinks",
  searchQuery: "search:query",
  workspaceSave: "workspace:save",
  workspaceLoad: "workspace:load"
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
  renameNote(oldPath: string, newPath: string): Promise<{ updatedCount: number }>;
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
  // workspace:*
  saveWorkspaceState(state: import("@ekm/shared-types").WorkspaceState): Promise<void>;
  loadWorkspaceState(): Promise<import("@ekm/shared-types").WorkspaceState | null>;
}


