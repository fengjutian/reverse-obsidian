export type { SearchResult, NotePath } from "@ekm/shared-types";

export interface SearchQuery {
  text: string;
  /** Optional field filter, e.g. "tag:name" or "path:folder" */
  field?: string;
}
