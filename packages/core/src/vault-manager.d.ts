import type { NoteMeta } from "@ekm/shared-types";
import type { VaultManager } from "./interfaces.js";
export declare class LocalVaultManager implements VaultManager {
    private workspacePath;
    open(workspacePath: string): Promise<void>;
    get notesRoot(): string;
    listNotes(): Promise<string[]>;
    readNote(path: string): Promise<string>;
    writeNote(path: string, content: string): Promise<void>;
    collectNoteMeta(): Promise<NoteMeta[]>;
    private collectMarkdownFiles;
}
//# sourceMappingURL=vault-manager.d.ts.map