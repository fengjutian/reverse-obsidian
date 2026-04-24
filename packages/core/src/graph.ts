import type { GraphData, GraphEdge, GraphNode } from "@ekm/shared-types";
import type { LocalVaultManager } from "./vault-manager.js";
import type { InMemoryLinkIndex } from "./link-index.js";
import { toTitleFromPath } from "./utils.js";

export async function buildBasicGraphData(
  vault: LocalVaultManager,
  linkIndex: InMemoryLinkIndex
): Promise<GraphData> {
  const notePaths = await vault.listNotes();
  const nodes: GraphNode[] = notePaths.map((path) => ({
    id: path,
    label: toTitleFromPath(path),
    type: "note"
  }));

  const edges: GraphEdge[] = linkIndex.getAllEdges().map((edge) => ({
    id: `${edge.sourcePath}=>${edge.targetPath}`,
    source: edge.sourcePath,
    target: edge.targetPath,
    type: edge.isEmbed ? "embed" : "reference"
  }));

  return { nodes, edges };
}
