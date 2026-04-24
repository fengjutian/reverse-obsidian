import { contextBridge, ipcRenderer } from "electron";
import type { DesktopApi } from "../shared/ipc.js";
import { IPC_CHANNELS } from "../shared/ipc.js";

const api: DesktopApi = {
  listNotes: () => ipcRenderer.invoke(IPC_CHANNELS.vaultListNotes),
  readNote: (path) => ipcRenderer.invoke(IPC_CHANNELS.noteRead, path),
  writeNote: (path, content) => ipcRenderer.invoke(IPC_CHANNELS.noteWrite, path, content),
  renderNote: (markdown) => ipcRenderer.invoke(IPC_CHANNELS.noteRender, markdown),
  getBacklinks: (path) => ipcRenderer.invoke(IPC_CHANNELS.noteBacklinks, path),
  search: (keyword, limit) => ipcRenderer.invoke(IPC_CHANNELS.searchQuery, keyword, limit)
};


contextBridge.exposeInMainWorld("ekm", api);
