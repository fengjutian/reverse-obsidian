import { contextBridge, ipcRenderer } from "electron";
import { z } from "zod";
import type { DesktopApi } from "../shared/ipc.js";
import { IPC_CHANNELS } from "../shared/ipc.js";

// ── Schemas ────────────────────────────────────────────────────────────────

const PathSchema = z.string().min(1);
const ContentSchema = z.string();
const KeywordSchema = z.string();
const LimitSchema = z.number().int().positive().optional();

// ── Validation helper ──────────────────────────────────────────────────────

function validate<T>(schema: z.ZodType<T>, value: unknown): T {
  const result = schema.safeParse(value);
  if (!result.success) {
    throw { code: "E_VALIDATION", message: result.error.message, details: result.error.issues };
  }
  return result.data;
}

// ── API implementation ─────────────────────────────────────────────────────

const api: DesktopApi = {
  // vault:*
  openVault: (path) => {
    validate(PathSchema, path);
    return ipcRenderer.invoke(IPC_CHANNELS.vaultOpen, path);
  },
  closeVault: () => ipcRenderer.invoke(IPC_CHANNELS.vaultClose),
  listRecentVaults: () => ipcRenderer.invoke(IPC_CHANNELS.vaultListRecent),
  listNotes: () => ipcRenderer.invoke(IPC_CHANNELS.vaultListNotes),

  // note:*
  readNote: (path) => {
    validate(PathSchema, path);
    return ipcRenderer.invoke(IPC_CHANNELS.noteRead, path);
  },
  writeNote: (path, content) => {
    validate(PathSchema, path);
    validate(ContentSchema, content);
    return ipcRenderer.invoke(IPC_CHANNELS.noteWrite, path, content);
  },
  deleteNote: (path) => {
    validate(PathSchema, path);
    return ipcRenderer.invoke(IPC_CHANNELS.noteDelete, path);
  },
  renderNote: (markdown) => {
    validate(ContentSchema, markdown);
    return ipcRenderer.invoke(IPC_CHANNELS.noteRender, markdown);
  },
  getBacklinks: (path) => {
    validate(PathSchema, path);
    return ipcRenderer.invoke(IPC_CHANNELS.noteBacklinks, path);
  },

  // search:*
  search: (keyword, limit) => {
    validate(KeywordSchema, keyword);
    validate(LimitSchema, limit);
    return ipcRenderer.invoke(IPC_CHANNELS.searchQuery, keyword, limit);
  },
};

contextBridge.exposeInMainWorld("ekm", api);
