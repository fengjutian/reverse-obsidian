import type { SearchResult } from "@ekm/shared-types";
import type { SearchEngine } from "./interfaces.js";
import type { LocalVaultManager } from "./vault-manager.js";
export declare class InMemorySearchEngine implements SearchEngine {
    private readonly vault;
    private docs;
    constructor(vault: LocalVaultManager);
    rebuild(): Promise<void>;
    updateByPath(path: string): Promise<void>;
    query(keyword: string, limit?: number): Promise<SearchResult[]>;
}
//# sourceMappingURL=search-engine.d.ts.map