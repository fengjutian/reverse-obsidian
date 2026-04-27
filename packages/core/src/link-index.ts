import { basename } from "node:path";
import type { LinkEdge } from "@ekm/shared-types";
import type { LinkIndex } from "./interfaces.js";
import { normalizeToPosixPath } from "./utils.js";
import type { LocalVaultManager } from "./vault-manager.js";

interface ParsedWikiLink {
  targetPath: string;
  alias?: string;
  anchor?: string;   // heading anchor (e.g. #heading)
  blockId?: string;  // block reference id (e.g. ^block-id)
  isEmbed: boolean;
}

// Groups: (1) embed!, (2) target, (3) heading anchor, (4) block id, (5) alias
const WIKILINK_PATTERN = /(!)?\[\[([^\]|#^]+)(?:#([^\]|^]+))?(?:\^([^\]|]+))?(?:\|([^\]]+))?\]\]/g;

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

    let content: string;
    try {
      content = await this.vault.readNote(path);
    } catch {
      // File may have been deleted — clear its links and return
      return;
    }

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

  async renameAndUpdateLinks(oldPath: string, newPath: string): Promise<{ updatedCount: number }> {
    const oldTitle = basename(oldPath, ".md");
    const newTitle = basename(newPath, ".md");
    const normalizedOld = normalizeToPosixPath(oldPath);

    const backlinkSources = await this.getBacklinks(normalizedOld);
    let updatedCount = 0;

    for (const sourcePath of backlinkSources) {
      let content: string;
      try {
        content = await this.vault.readNote(sourcePath);
      } catch {
        continue;
      }
      const updated = content.split(`[[${oldTitle}`).join(`[[${newTitle}`);
      if (updated !== content) {
        await this.vault.writeNote(sourcePath, updated);
        updatedCount++;
      }
    }

    await this.vault.renameNote(oldPath, newPath);
    await this.updateByPath(newPath);

    for (const sourcePath of backlinkSources) {
      await this.updateByPath(sourcePath);
    }

    return { updatedCount };
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
    const anchor = match[3]?.trim() || undefined;
    const blockId = match[4]?.trim() || undefined;
    const alias = match[5]?.trim() || undefined;

    if (!rawTarget) continue;

    const targetPath = rawTarget.endsWith(".md") ? rawTarget : `${rawTarget}.md`;
    links.push({ targetPath, alias, anchor, blockId, isEmbed });
  }

  return links;
}
