export type { NotePath } from "@ekm/shared-types";

export interface ParsedDocument {
  /** Raw markdown source */
  source: string;
  /** Extracted WikiLink targets */
  wikiLinks: string[];
  /** Extracted embed targets */
  embeds: string[];
}
