import { mkdir, readdir, readFile, rename, rm, stat, writeFile } from "node:fs/promises";
import { dirname, extname, join, relative } from "node:path";
import type { NoteMeta, VaultConfig } from "@ekm/shared-types";
import type { VaultManager } from "./interfaces.js";
import { normalizeToPosixPath, sha256, toTitleFromPath } from "./utils.js";

const EKM_DIR = ".ekm";
const CONFIG_FILE = "config.json";
const APP_VERSION = "1.0.0";

export class LocalVaultManager implements VaultManager {
  private workspacePath = "";

  async open(workspacePath: string): Promise<void> {
    this.workspacePath = workspacePath;

    const ekmDir = join(workspacePath, EKM_DIR);
    const configPath = join(ekmDir, CONFIG_FILE);

    let ekmExists = false;
    try {
      await stat(ekmDir);
      ekmExists = true;
    } catch {
      ekmExists = false;
    }

    if (!ekmExists) {
      // Initialize new vault
      await mkdir(ekmDir, { recursive: true });
      await mkdir(this.notesRoot, { recursive: true });

      const config: VaultConfig = {
        version: APP_VERSION,
        name: workspacePath.split(/[\\/]/).pop() ?? "Vault",
        createdAt: new Date().toISOString(),
      };
      await writeFile(configPath, JSON.stringify(config, null, 2), "utf8");
    } else {
      // Ensure notes root exists even for existing vaults
      await mkdir(this.notesRoot, { recursive: true });
    }
  }

  get notesRoot(): string {
    if (!this.workspacePath) {
      throw new Error("Vault not opened. Please call open(workspacePath) first.");
    }
    return join(this.workspacePath, "notes");
  }

  async listNotes(): Promise<string[]> {
    const files = await this.collectMarkdownFiles(this.notesRoot);
    return files
      .map((file) => normalizeToPosixPath(relative(this.notesRoot, file)))
      .sort((a, b) => a.localeCompare(b));
  }

  async readNote(path: string): Promise<string> {
    const fullPath = join(this.notesRoot, path);
    return readFile(fullPath, "utf8");
  }

  async writeNote(path: string, content: string): Promise<void> {
    const fullPath = join(this.notesRoot, path);
    const tmpPath = `${fullPath}.tmp`;
    await mkdir(dirname(fullPath), { recursive: true });
    await writeFile(tmpPath, content, "utf8");
    await rename(tmpPath, fullPath);
  }

  async deleteNote(path: string): Promise<void> {
    const fullPath = join(this.notesRoot, path);
    await rm(fullPath, { force: true });
  }

  async renameNote(oldPath: string, newPath: string): Promise<void> {
    const oldFull = join(this.notesRoot, oldPath);
    const newFull = join(this.notesRoot, newPath);
    await mkdir(dirname(newFull), { recursive: true });
    await rename(oldFull, newFull);
  }

  async collectNoteMeta(): Promise<NoteMeta[]> {
    const notePaths = await this.listNotes();
    const rows = await Promise.all(
      notePaths.map(async (path) => {
        const fullPath = join(this.notesRoot, path);
        const content = await readFile(fullPath, "utf8");
        const info = await stat(fullPath);

        return {
          id: normalizeToPosixPath(path),
          path: normalizeToPosixPath(path),
          title: toTitleFromPath(path),
          hash: sha256(content),
          createdAt: info.birthtime.toISOString(),
          updatedAt: info.mtime.toISOString()
        } satisfies NoteMeta;
      })
    );

    return rows;
  }

  private async collectMarkdownFiles(root: string): Promise<string[]> {
    const entries = await readdir(root, { withFileTypes: true });
    const result: string[] = [];

    for (const entry of entries) {
      const fullPath = join(root, entry.name);
      if (entry.isDirectory()) {
        result.push(...(await this.collectMarkdownFiles(fullPath)));
        continue;
      }

      if (entry.isFile() && extname(entry.name).toLowerCase() === ".md") {
        result.push(fullPath);
      }
    }

    return result;
  }
}
