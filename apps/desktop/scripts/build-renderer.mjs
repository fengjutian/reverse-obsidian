import * as esbuild from "esbuild";
import { mkdir, copyFile } from "node:fs/promises";
import { join } from "node:path";

const projectRoot = process.cwd();
const srcRendererDir = join(projectRoot, "src", "renderer");
const outRendererDir = join(projectRoot, "dist", "renderer");

await mkdir(outRendererDir, { recursive: true });

const rendererContext = await esbuild.context({
  entryPoints: [
    join(srcRendererDir, "index.ts"),
    join(srcRendererDir, "editor.ts"),
    join(srcRendererDir, "markdown-renderer.ts"),
  ],
  bundle: true,
  format: "esm",
  outdir: outRendererDir,
  splitting: true,
  sourcemap: true,
  target: "chrome130",
  conditions: ["browser"],
});

await rendererContext.rebuild();
await rendererContext.dispose();

await copyFile(join(srcRendererDir, "index.html"), join(outRendererDir, "index.html"));
await copyFile(join(srcRendererDir, "styles.css"), join(outRendererDir, "styles.css"));

console.log("Renderer build complete");