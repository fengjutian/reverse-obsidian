import { mkdir, readdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { dirname, extname, join, relative } from "node:path";
import type { NoteMeta } from "@ekm/shared-types";
import type { VaultManager } from "./interfaces.js";
import { normalizeToPosixPath, sha256, toTitleFromPath } from "./utils.js";

export class LocalVaultManager implements VaultManager {
  private workspacePath = "";

  async open(workspacePath: string): Promise<void> {
    this.workspacePath = workspacePath;
    await mkdir(this.notesRoot, { recursive: true });
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
    await mkdir(dirname(fullPath), { recursive: true });
    await writeFile(fullPath, content, "utf8");
  }

  async deleteNote(path: string): Promise<void> {
    const fullPath = join(this.notesRoot, path);
    await rm(fullPath, { force: true });
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
