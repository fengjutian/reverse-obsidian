import type { SearchResult } from "@ekm/shared-types";
import type { SearchEngine } from "./interfaces.js";
import { scoreTextMatch, snippetAroundKeyword, toTitleFromPath } from "./utils.js";
import type { LocalVaultManager } from "./vault-manager.js";

interface IndexedDocument {
  path: string;
  title: string;
  content: string;
}

export class InMemorySearchEngine implements SearchEngine {
  private docs = new Map<string, IndexedDocument>();

  constructor(private readonly vault: LocalVaultManager) {}

  async rebuild(): Promise<void> {
    this.docs.clear();
    const notes = await this.vault.listNotes();

    await Promise.all(
      notes.map(async (path) => {
        await this.updateByPath(path);
      })
    );
  }

  async updateByPath(path: string): Promise<void> {
    const content = await this.vault.readNote(path);
    this.docs.set(path, {
      path,
      title: toTitleFromPath(path),
      content
    });
  }

  async query(keyword: string, limit = 20): Promise<SearchResult[]> {
    const normalizedKeyword = keyword.trim();
    if (!normalizedKeyword) return [];

    const hits: SearchResult[] = [];

    for (const doc of this.docs.values()) {
      const titleScore = scoreTextMatch(normalizedKeyword, doc.title) * 1.4;
      const contentScore = scoreTextMatch(normalizedKeyword, doc.content);
      const score = titleScore + contentScore;

      if (score <= 0) continue;

      hits.push({
        path: doc.path,
        title: doc.title,
        score,
        snippet: snippetAroundKeyword(normalizedKeyword, doc.content)
      });
    }

    return hits.sort((a, b) => b.score - a.score).slice(0, limit);
  }
}
