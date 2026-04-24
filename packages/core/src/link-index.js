import { normalizeToPosixPath } from "./utils.js";
const WIKILINK_PATTERN = /(!)?\[\[([^\]|#]+)(?:#[^\]|]+)?(?:\|([^\]]+))?\]\]/g;
export class InMemoryLinkIndex {
    vault;
    edges = [];
    backlinks = new Map();
    constructor(vault) {
        this.vault = vault;
    }
    async rebuild() {
        this.edges = [];
        this.backlinks.clear();
        const notes = await this.vault.listNotes();
        for (const notePath of notes) {
            await this.updateByPath(notePath);
        }
    }
    async updateByPath(path) {
        const normalizedSource = normalizeToPosixPath(path);
        this.edges = this.edges.filter((edge) => edge.sourcePath !== normalizedSource);
        for (const sources of this.backlinks.values()) {
            sources.delete(normalizedSource);
        }
        const content = await this.vault.readNote(path);
        const links = parseWikiLinks(content);
        for (const link of links) {
            const edge = {
                sourcePath: normalizedSource,
                targetPath: normalizeToPosixPath(link.targetPath),
                alias: link.alias,
                isEmbed: link.isEmbed
            };
            this.edges.push(edge);
            if (!this.backlinks.has(edge.targetPath)) {
                this.backlinks.set(edge.targetPath, new Set());
            }
            this.backlinks.get(edge.targetPath)?.add(edge.sourcePath);
        }
    }
    async getBacklinks(path) {
        const normalizedTarget = normalizeToPosixPath(path);
        return [...(this.backlinks.get(normalizedTarget) ?? new Set())].sort((a, b) => a.localeCompare(b));
    }
    getAllEdges() {
        return [...this.edges];
    }
}
export function parseWikiLinks(markdown) {
    const links = [];
    const matches = markdown.matchAll(WIKILINK_PATTERN);
    for (const match of matches) {
        const isEmbed = Boolean(match[1]);
        const rawTarget = match[2]?.trim();
        const alias = match[3]?.trim();
        if (!rawTarget)
            continue;
        const targetPath = rawTarget.endsWith(".md") ? rawTarget : `${rawTarget}.md`;
        links.push({ targetPath, alias, isEmbed });
    }
    return links;
}
//# sourceMappingURL=link-index.js.map