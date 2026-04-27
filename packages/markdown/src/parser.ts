import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import remarkFootnotes from "remark-footnotes";
import remarkRehype from "remark-rehype";
import rehypeHighlight from "rehype-highlight";
import rehypeStringify from "rehype-stringify";
import type { Plugin } from "unified";
import type { Root as MdastRoot, Text, Parent, Node } from "mdast";
import type { Root as HastRoot, Element } from "hast";
import type { VFileCompatible } from "vfile";
import { visit } from "unist-util-visit";
import { toString } from "mdast-util-to-string";

export interface ParseOptions {
  resolveWikiLink?: (target: string) => string | null;
}

export interface ParseResult {
  html: string;
  wikiLinks: Array<{ target: string; alias?: string; isEmbed: boolean }>;
  headings: Array<{ level: number; text: string; id: string }>;
}

// Custom MDAST node types
interface WikiLinkNode extends Node {
  type: "wikiLink";
  target: string;
  alias?: string;
  isEmbed: boolean;
}

declare module "mdast" {
  interface RootContentMap {
    wikiLink: WikiLinkNode;
  }
  interface PhrasingContentMap {
    wikiLink: WikiLinkNode;
  }
}

// Slugify heading text to generate IDs
function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

// WikiLink remark plugin: parses [[target]], [[target|alias]], ![[embed]] in text nodes
const remarkWikiLink: Plugin<[], MdastRoot> = function () {
  return (tree: MdastRoot) => {
    visit(tree, "text", (node: Text, index, parent: Parent | null) => {
      if (!parent || index === undefined || index === null) return;

      const wikiLinkPattern = /(!)?\[\[([^\]|#]+)(?:#[^\]|]+)?(?:\|([^\]]+))?\]\]/g;
      const value = node.value;
      let match: RegExpExecArray | null;
      const newNodes: (Text | WikiLinkNode)[] = [];
      let lastIndex = 0;

      while ((match = wikiLinkPattern.exec(value)) !== null) {
        const [full, bang, rawTarget, alias] = match;
        const target = rawTarget.trim();
        const isEmbed = bang === "!";

        if (match.index > lastIndex) {
          newNodes.push({ type: "text", value: value.slice(lastIndex, match.index) });
        }

        newNodes.push({
          type: "wikiLink",
          target,
          alias: alias?.trim(),
          isEmbed,
        } as WikiLinkNode);

        lastIndex = match.index + full.length;
      }

      if (newNodes.length === 0) return;

      if (lastIndex < value.length) {
        newNodes.push({ type: "text", value: value.slice(lastIndex) });
      }

      parent.children.splice(index, 1, ...(newNodes as any[]));
      return index + newNodes.length;
    });
  };
};

export async function parseMarkdown(
  source: string,
  options?: ParseOptions
): Promise<ParseResult> {
  const wikiLinks: ParseResult["wikiLinks"] = [];
  const headings: ParseResult["headings"] = [];

  const resolveWikiLink = options?.resolveWikiLink ?? (() => null);

  // Build the unified pipeline
  const processor = unified()
    .use(remarkParse)
    .use(remarkGfm)
    .use(remarkMath)
    .use(remarkFootnotes as any, { inlineNotes: true })
    .use(remarkWikiLink)
    // Extract headings from MDAST before converting to hast
    .use(function extractHeadings() {
      return (tree: MdastRoot) => {
        visit(tree, "heading", (node: any) => {
          const text = toString(node);
          headings.push({
            level: node.depth as number,
            text,
            id: slugify(text),
          });
        });
      };
    })
    // Collect wikiLinks before rehype conversion
    .use(function collectWikiLinks() {
      return (tree: MdastRoot) => {
        visit(tree, "wikiLink", (node: WikiLinkNode) => {
          wikiLinks.push({
            target: node.target,
            alias: node.alias,
            isEmbed: node.isEmbed,
          });
        });
      };
    })
    .use(remarkRehype as any, {
      allowDangerousHtml: true,
      handlers: {
        wikiLink(state: any, node: WikiLinkNode) {
          const { target, alias, isEmbed } = node;
          const displayText = alias ?? target;

          if (isEmbed) {
            return {
              type: "element",
              tagName: "span",
              properties: {
                className: ["embed"],
                dataTarget: target,
              },
              children: [{ type: "text", value: displayText }],
            };
          }

          const href = resolveWikiLink(target);
          const resolved = href !== null;
          return {
            type: "element",
            tagName: "a",
            properties: {
              className: resolved ? ["wikilink"] : ["wikilink", "unresolved"],
              href: resolved ? href : `#unresolved-${slugify(target)}`,
            },
            children: [{ type: "text", value: displayText }],
          };
        },
        // Handle mermaid code blocks
        code(state: any, node: any) {
          if (node.lang === "mermaid") {
            return {
              type: "element",
              tagName: "div",
              properties: { className: ["mermaid"] },
              children: [{ type: "text", value: node.value }],
            };
          }
          // Fall through to default handler
          return state.all(node);
        },
      },
    })
    .use(rehypeHighlight as any, { ignoreMissing: true })
    .use(rehypeStringify as any, { allowDangerousHtml: true });

  const file = await processor.process(source as VFileCompatible);
  const html = String(file);

  return { html, wikiLinks, headings };
}
