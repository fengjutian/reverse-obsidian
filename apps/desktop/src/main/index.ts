import { app, BrowserWindow, ipcMain, IpcMainInvokeEvent } from "electron";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { homedir } from "node:os";
import {
  InMemoryLinkIndex,
  InMemorySearchEngine,
  LocalVaultManager,
  renderMarkdownWithWikiLink
} from "@ekm/core";
import type { WorkspaceState } from "@ekm/shared-types";

import { IPC_CHANNELS } from "../shared/ipc.js";
import { assertWithinVault } from "./path-guard.js";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const mainDir = dirname(fileURLToPath(import.meta.url));
const preloadEntry = join(mainDir, "../preload/index.js");
const rendererHtml = join(mainDir, "../renderer/index.html");

const RECENT_FILE = join(homedir(), ".ekm", "recent.json");
const MAX_RECENT = 20;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface WindowEntry {
  win: BrowserWindow;
  vaultPath: string;
  vault: LocalVaultManager;
  links: InMemoryLinkIndex;
  search: InMemorySearchEngine;
}

// ---------------------------------------------------------------------------
// WindowManager
// ---------------------------------------------------------------------------

class WindowManager {
  /** Map from webContents.id → WindowEntry */
  private readonly windows = new Map<number, WindowEntry>();
  /** Map from vaultPath → webContents.id (for dedup) */
  private readonly pathIndex = new Map<string, number>();

  async openVault(vaultPath: string): Promise<BrowserWindow> {
    // Focus existing window if already open
    const existingId = this.pathIndex.get(vaultPath);
    if (existingId !== undefined) {
      const entry = this.windows.get(existingId);
      if (entry) {
        entry.win.focus();
        return entry.win;
      }
    }

    const vault = new LocalVaultManager();
    const links = new InMemoryLinkIndex(vault);
    const search = new InMemorySearchEngine(vault);

    await mkdir(join(vaultPath, "notes"), { recursive: true });
    await vault.open(vaultPath);
    await links.rebuild();
    await search.rebuild();

    const win = new BrowserWindow({
      width: 1200,
      height: 800,
      minWidth: 960,
      minHeight: 640,
      backgroundColor: "#111827",
      webPreferences: {
        preload: preloadEntry,
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true
      }
    });

    const id = win.webContents.id;
    this.windows.set(id, { win, vaultPath, vault, links, search });
    this.pathIndex.set(vaultPath, id);

    win.on("close", async () => {
      // Save a minimal workspace state; the renderer should call workspace:save
      // before this fires, but we ensure the file exists with a default.
      const entry = this.windows.get(id);
      if (entry) {
        const existing = await entry.vault.loadWorkspaceState();
        if (!existing) {
          const defaultState: WorkspaceState = {
            version: "1.0.0",
            layout: "single",
            panes: [],
            savedAt: new Date().toISOString()
          };
          await entry.vault.saveWorkspaceState(defaultState).catch(() => undefined);
        }
      }
    });

    win.on("closed", () => {
      this.windows.delete(id);
      if (this.pathIndex.get(vaultPath) === id) {
        this.pathIndex.delete(vaultPath);
      }
    });

    await win.loadFile(rendererHtml);
    await addRecentVault(vaultPath);

    return win;
  }

  closeVault(webContentsId: number): void {
    const entry = this.windows.get(webContentsId);
    if (entry) {
      entry.win.close();
    }
  }

  getEntry(webContentsId: number): WindowEntry | undefined {
    return this.windows.get(webContentsId);
  }

  hasWindows(): boolean {
    return this.windows.size > 0;
  }
}

// ---------------------------------------------------------------------------
// Recent vaults helpers
// ---------------------------------------------------------------------------

async function readRecentVaults(): Promise<string[]> {
  try {
    const raw = await readFile(RECENT_FILE, "utf8");
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function addRecentVault(vaultPath: string): Promise<void> {
  const recent = await readRecentVaults();
  const updated = [vaultPath, ...recent.filter((p) => p !== vaultPath)].slice(0, MAX_RECENT);
  await mkdir(dirname(RECENT_FILE), { recursive: true });
  await writeFile(RECENT_FILE, JSON.stringify(updated, null, 2), "utf8");
}

// ---------------------------------------------------------------------------
// IPC registration
// ---------------------------------------------------------------------------

function registerIpcHandlers(manager: WindowManager): void {
  // --- Vault window management ---

  ipcMain.handle(IPC_CHANNELS.vaultOpen, async (_event, vaultPath: string) => {
    await manager.openVault(vaultPath);
  });

  ipcMain.handle(IPC_CHANNELS.vaultClose, async (event: IpcMainInvokeEvent) => {
    manager.closeVault(event.sender.id);
  });

  ipcMain.handle(IPC_CHANNELS.vaultListRecent, async () => {
    return readRecentVaults();
  });

  // --- Per-window note/search handlers (scoped by event.sender.id) ---

  ipcMain.handle(IPC_CHANNELS.vaultListNotes, async (event: IpcMainInvokeEvent) => {
    const entry = manager.getEntry(event.sender.id);
    if (!entry) return [];
    return entry.vault.listNotes();
  });

  ipcMain.handle(IPC_CHANNELS.noteRead, async (event: IpcMainInvokeEvent, path: string) => {
    try {
      const entry = manager.getEntry(event.sender.id);
      if (!entry) return { code: "E_NO_VAULT", message: "No vault open for this window" };
      assertWithinVault(entry.vault.notesRoot, path);
      return entry.vault.readNote(path);
    } catch (err: unknown) {
      if (err && typeof err === "object" && "code" in err) return err;
      return { code: "E_READ_FAILED", message: String(err), details: err };
    }
  });

  ipcMain.handle(IPC_CHANNELS.noteWrite, async (event: IpcMainInvokeEvent, path: string, content: string) => {
    try {
      const entry = manager.getEntry(event.sender.id);
      if (!entry) return { code: "E_NO_VAULT", message: "No vault open for this window" };
      assertWithinVault(entry.vault.notesRoot, path);
      await entry.vault.writeNote(path, content);
      await entry.search.updateByPath(path);
      await entry.links.updateByPath(path);
    } catch (err: unknown) {
      if (err && typeof err === "object" && "code" in err) return err;
      return { code: "E_WRITE_FAILED", message: String(err), details: err };
    }
  });

  ipcMain.handle(IPC_CHANNELS.noteDelete, async (event: IpcMainInvokeEvent, path: string) => {
    try {
      const entry = manager.getEntry(event.sender.id);
      if (!entry) return { code: "E_NO_VAULT", message: "No vault open for this window" };
      assertWithinVault(entry.vault.notesRoot, path);
      await entry.vault.deleteNote(path);
      await entry.links.updateByPath(path);
      await entry.search.updateByPath(path);
    } catch (err: unknown) {
      if (err && typeof err === "object" && "code" in err) return err;
      return { code: "E_DELETE_FAILED", message: String(err), details: err };
    }
  });

  ipcMain.handle(IPC_CHANNELS.noteRename, async (event: IpcMainInvokeEvent, oldPath: string, newPath: string) => {
    try {
      const entry = manager.getEntry(event.sender.id);
      if (!entry) return { code: "E_NO_VAULT", message: "No vault open for this window" };
      assertWithinVault(entry.vault.notesRoot, oldPath);
      assertWithinVault(entry.vault.notesRoot, newPath);
      return await entry.links.renameAndUpdateLinks(oldPath, newPath);
    } catch (err: unknown) {
      if (err && typeof err === "object" && "code" in err) return err;
      return { code: "E_RENAME_FAILED", message: String(err), details: err };
    }
  });

  ipcMain.handle(IPC_CHANNELS.noteRender, async (_event, markdown: string) => {
    return renderMarkdownWithWikiLink(markdown);
  });

  ipcMain.handle(IPC_CHANNELS.noteBacklinks, async (event: IpcMainInvokeEvent, path: string) => {
    const entry = manager.getEntry(event.sender.id);
    if (!entry) return [];
    return entry.links.getBacklinks(path);
  });

  ipcMain.handle(IPC_CHANNELS.searchQuery, async (event: IpcMainInvokeEvent, keyword: string, limit?: number) => {
    const entry = manager.getEntry(event.sender.id);
    if (!entry) return [];
    return entry.search.query(keyword, limit);
  });

  ipcMain.handle(IPC_CHANNELS.workspaceSave, async (event: IpcMainInvokeEvent, state: WorkspaceState) => {
    const entry = manager.getEntry(event.sender.id);
    if (!entry) return;
    await entry.vault.saveWorkspaceState(state);
  });

  ipcMain.handle(IPC_CHANNELS.workspaceLoad, async (event: IpcMainInvokeEvent) => {
    const entry = manager.getEntry(event.sender.id);
    if (!entry) return null;
    return entry.vault.loadWorkspaceState();
  });
}

// ---------------------------------------------------------------------------
// Bootstrap
// ---------------------------------------------------------------------------

async function bootstrap(): Promise<void> {
  const manager = new WindowManager();
  registerIpcHandlers(manager);

  // Open the default workspace on first launch
  const defaultVaultPath = join(process.cwd(), "workspace");
  await manager.openVault(defaultVaultPath);

  app.on("activate", async () => {
    if (!manager.hasWindows()) {
      await manager.openVault(defaultVaultPath);
    }
  });
}

app.whenReady().then(() => {
  bootstrap().catch((error) => {
    console.error("bootstrap failed", error);
    app.exit(1);
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
