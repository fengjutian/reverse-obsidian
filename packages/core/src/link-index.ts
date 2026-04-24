import type { LinkEdge } from "@ekm/shared-types";
import type { LinkIndex } from "./interfaces.js";
import { normalizeToPosixPath } from "./utils.js";
import type { LocalVaultManager } from "./vault-manager.js";

interface ParsedWikiLink {
  targetPath: string;
  alias?: string;
  isEmbed: boolean;
}

const WIKILINK_PATTERN = /(!)?\[\[([^\]|#]+)(?:#[^\]|]+)?(?:\|([^\]]+))?\]\]/g;

export class InMemoryLinkIndex implements LinkIndex {
  private edges: LinkEdge[] = [];
  private backlinks = new Map<string, Set<string>>();

  constructor(private readonly vault: LocalVaultManager) {}

  async rebuild(): Promise<void> {
    this.edges = [];
    this.backlinks.clear();

    const notes = await this.vault.listNotes();
    for (const notePath of notes) {
      await this.updateByPath(notePath);
    }
  }

  async updateByPath(path: string): Promise<void> {
    const normalizedSource = normalizeToPosixPath(path);
    this.edges = this.edges.filter((edge) => edge.sourcePath !== normalizedSource);

    for (const sources of this.backlinks.values()) {
      sources.delete(normalizedSource);
    }

    const content = await this.vault.readNote(path);
    const links = parseWikiLinks(content);

    for (const link of links) {
      const edge: LinkEdge = {
        sourcePath: normalizedSource,
        targetPath: normalizeToPosixPath(link.targetPath),
        alias: link.alias,
        isEmbed: link.isEmbed
      };

      this.edges.push(edge);

      if (!this.backlinks.has(edge.targetPath)) {
        this.backlinks.set(edge.targetPath, new Set<string>());
      }
      this.backlinks.get(edge.targetPath)?.add(edge.sourcePath);
    }
  }

  async getBacklinks(path: string): Promise<string[]> {
    const normalizedTarget = normalizeToPosixPath(path);
    return [...(this.backlinks.get(normalizedTarget) ?? new Set<string>())].sort((a, b) =>
      a.localeCompare(b)
    );
  }

  getAllEdges(): LinkEdge[] {
    return [...this.edges];
  }
}

export function parseWikiLinks(markdown: string): ParsedWikiLink[] {
  const links: ParsedWikiLink[] = [];
  const matches = markdown.matchAll(WIKILINK_PATTERN);

  for (const match of matches) {
    const isEmbed = Boolean(match[1]);
    const rawTarget = match[2]?.trim();
    const alias = match[3]?.trim();

    if (!rawTarget) continue;

    const targetPath = rawTarget.endsWith(".md") ? rawTarget : `${rawTarget}.md`;
    links.push({ targetPath, alias, isEmbed });
  }

  return links;
}
