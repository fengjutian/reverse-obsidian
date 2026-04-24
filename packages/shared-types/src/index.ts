export type NotePath = string;

export interface NoteMeta {
  id: string;
  path: NotePath;
  title: string;
  hash: string;
  createdAt: string;
  updatedAt: string;
}

export interface SearchResult {
  path: NotePath;
  title: string;
  score: number;
  snippet: string;
}

export interface LinkEdge {
  sourcePath: NotePath;
  targetPath: NotePath;
  alias?: string;
  isEmbed: boolean;
}

export interface GraphNode {
  id: string;
  label: string;
  type: "note" | "tag" | "attachment";
}

export interface GraphEdge {
  id: string;
  source: string;
  target: string;
  type: "reference" | "embed" | "tagged";
}

export interface GraphData {
  nodes: GraphNode[];
  edges: GraphEdge[];
}
