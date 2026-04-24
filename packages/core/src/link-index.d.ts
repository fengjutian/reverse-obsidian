import type { LinkEdge } from "@ekm/shared-types";
import type { LinkIndex } from "./interfaces.js";
import type { LocalVaultManager } from "./vault-manager.js";
interface ParsedWikiLink {
    targetPath: string;
    alias?: string;
    isEmbed: boolean;
}
export declare class InMemoryLinkIndex implements LinkIndex {
    private readonly vault;
    private edges;
    private backlinks;
    constructor(vault: LocalVaultManager);
    rebuild(): Promise<void>;
    updateByPath(path: string): Promise<void>;
    getBacklinks(path: string): Promise<string[]>;
    getAllEdges(): LinkEdge[];
}
export declare function parseWikiLinks(markdown: string): ParsedWikiLink[];
export {};
//# sourceMappingURL=link-index.d.ts.map