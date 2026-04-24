import { mkdir, readdir, readFile, stat, writeFile } from "node:fs/promises";
import { dirname, extname, join, relative } from "node:path";
import { normalizeToPosixPath, sha256, toTitleFromPath } from "./utils.js";
export class LocalVaultManager {
    workspacePath = "";
    async open(workspacePath) {
        this.workspacePath = workspacePath;
        await mkdir(this.notesRoot, { recursive: true });
    }
    get notesRoot() {
        if (!this.workspacePath) {
            throw new Error("Vault not opened. Please call open(workspacePath) first.");
        }
        return join(this.workspacePath, "notes");
    }
    async listNotes() {
        const files = await this.collectMarkdownFiles(this.notesRoot);
        return files
            .map((file) => normalizeToPosixPath(relative(this.notesRoot, file)))
            .sort((a, b) => a.localeCompare(b));
    }
    async readNote(path) {
        const fullPath = join(this.notesRoot, path);
        return readFile(fullPath, "utf8");
    }
    async writeNote(path, content) {
        const fullPath = join(this.notesRoot, path);
        await mkdir(dirname(fullPath), { recursive: true });
        await writeFile(fullPath, content, "utf8");
    }
    async collectNoteMeta() {
        const notePaths = await this.listNotes();
        const rows = await Promise.all(notePaths.map(async (path) => {
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
            };
        }));
        return rows;
    }
    async collectMarkdownFiles(root) {
        const entries = await readdir(root, { withFileTypes: true });
        const result = [];
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
//# sourceMappingURL=vault-manager.js.map