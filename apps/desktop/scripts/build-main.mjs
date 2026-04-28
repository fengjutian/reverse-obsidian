import * as esbuild from "esbuild";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";

const projectRoot = process.cwd();
const outDir = join(projectRoot, "dist", "main");

await mkdir(outDir, { recursive: true });

const requireShim = `
const { createRequire } = require("node:module");
const _require = createRequire(__filename);
globalThis.require = _require;
`.trim();

await esbuild.build({
  entryPoints: [
    join(projectRoot, "src", "main", "index.ts"),
    join(projectRoot, "src", "main", "path-guard.ts"),
  ],
  bundle: true,
  platform: "node",
  target: "node18",
  outdir: outDir,
  sourcemap: true,
  format: "cjs",
  outExtension: { ".js": ".cjs" },
  external: ["electron", "@ekm/shared-types", "sql.js"],
  banner: {
    js: requireShim,
  },
});

console.log("Main process build complete");