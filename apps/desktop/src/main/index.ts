import { app, BrowserWindow, ipcMain } from "electron";
import { mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import {
  InMemoryLinkIndex,
  InMemorySearchEngine,
  LocalVaultManager,
  renderMarkdownWithWikiLink
} from "@ekm/core";

import { IPC_CHANNELS } from "../shared/ipc.js";


const vault = new LocalVaultManager();
const links = new InMemoryLinkIndex(vault);
const search = new InMemorySearchEngine(vault);


const mainDir = dirname(fileURLToPath(import.meta.url));
const preloadEntry = join(mainDir, "../preload/index.js");
const rendererHtml = join(mainDir, "../renderer/index.html");

async function createMainWindow(): Promise<BrowserWindow> {
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

  await win.loadFile(rendererHtml);

  return win;
}


function registerIpcHandlers() {
  ipcMain.handle(IPC_CHANNELS.vaultListNotes, async () => {
    return vault.listNotes();
  });

  ipcMain.handle(IPC_CHANNELS.noteRead, async (_event, path: string) => {
    return vault.readNote(path);
  });

  ipcMain.handle(IPC_CHANNELS.noteWrite, async (_event, path: string, content: string) => {
    await vault.writeNote(path, content);
    await search.updateByPath(path);
    await links.updateByPath(path);
  });

  ipcMain.handle(IPC_CHANNELS.noteRender, async (_event, markdown: string) => {
    return renderMarkdownWithWikiLink(markdown);
  });

  ipcMain.handle(IPC_CHANNELS.noteBacklinks, async (_event, path: string) => {
    return links.getBacklinks(path);
  });

  ipcMain.handle(IPC_CHANNELS.searchQuery, async (_event, keyword: string, limit?: number) => {
    return search.query(keyword, limit);
  });
}


async function bootstrap(): Promise<void> {
  const workspacePath = join(process.cwd(), "workspace");
  await mkdir(join(workspacePath, "notes"), { recursive: true });

  await vault.open(workspacePath);
  await links.rebuild();
  await search.rebuild();


  registerIpcHandlers();
  await createMainWindow();
}

app.whenReady().then(() => {
  bootstrap().catch((error) => {
    console.error("bootstrap failed", error);
    app.exit(1);
  });

  app.on("activate", async () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      await createMainWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
