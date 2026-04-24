import { toTitleFromPath } from "./utils.js";
export async function buildBasicGraphData(vault, linkIndex) {
    const notePaths = await vault.listNotes();
    const nodes = notePaths.map((path) => ({
        id: path,
        label: toTitleFromPath(path),
        type: "note"
    }));
    const edges = linkIndex.getAllEdges().map((edge) => ({
        id: `${edge.sourcePath}=>${edge.targetPath}`,
        source: edge.sourcePath,
        target: edge.targetPath,
        type: edge.isEmbed ? "embed" : "reference"
    }));
    return { nodes, edges };
}
//# sourceMappingURL=graph.js.map