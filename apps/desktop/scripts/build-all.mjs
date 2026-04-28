import * as esbuild from "esbuild";
import { mkdir, copyFile, rm } from "node:fs/promises";
import { join } from "node:path";

const projectRoot = process.cwd();
const srcDir = join(projectRoot, "src");
const outDir = join(projectRoot, "dist");

await mkdir(outDir, { recursive: true });

await esbuild.build({
  entryPoints: [
    join(srcDir, "preload", "index.ts"),
    join(srcDir, "main", "index.ts"),
    join(srcDir, "main", "path-guard.ts"),
  ],
  bundle: true,
  platform: "node",
  target: "node18",
  outdir: outDir,
  sourcemap: true,
  external: ["electron", "zod", "@ekm/core", "@ekm/markdown", "@ekm/shared-types"],
  format: "esm",
  conditions: ["node"],
});

const rendererOutDir = join(outDir, "renderer");
await mkdir(rendererOutDir, { recursive: true });

const rendererContext = await esbuild.context({
  entryPoints: [
    join(srcDir, "renderer", "index.ts"),
    join(srcDir, "renderer", "editor.ts"),
    join(srcDir, "renderer", "markdown-renderer.ts"),
  ],
  bundle: true,
  format: "esm",
  outdir: rendererOutDir,
  splitting: true,
  sourcemap: true,
  target: "chrome130",
  conditions: ["browser"],
});

await rendererContext.rebuild();
await rendererContext.dispose();

await copyFile(join(srcDir, "renderer", "index.html"), join(rendererOutDir, "index.html"));
await copyFile(join(srcDir, "renderer", "styles.css"), join(rendererOutDir, "styles.css"));

console.log("Build complete");