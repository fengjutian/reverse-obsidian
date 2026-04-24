import { scoreTextMatch, snippetAroundKeyword, toTitleFromPath } from "./utils.js";
export class InMemorySearchEngine {
    vault;
    docs = new Map();
    constructor(vault) {
        this.vault = vault;
    }
    async rebuild() {
        this.docs.clear();
        const notes = await this.vault.listNotes();
        await Promise.all(notes.map(async (path) => {
            await this.updateByPath(path);
        }));
    }
    async updateByPath(path) {
        const content = await this.vault.readNote(path);
        this.docs.set(path, {
            path,
            title: toTitleFromPath(path),
            content
        });
    }
    async query(keyword, limit = 20) {
        const normalizedKeyword = keyword.trim();
        if (!normalizedKeyword)
            return [];
        const hits = [];
        for (const doc of this.docs.values()) {
            const titleScore = scoreTextMatch(normalizedKeyword, doc.title) * 1.4;
            const contentScore = scoreTextMatch(normalizedKeyword, doc.content);
            const score = titleScore + contentScore;
            if (score <= 0)
                continue;
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
//# sourceMappingURL=search-engine.js.map