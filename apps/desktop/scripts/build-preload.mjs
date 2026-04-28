import * as esbuild from "esbuild";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";

const projectRoot = process.cwd();
const outDir = join(projectRoot, "dist", "preload");

await mkdir(outDir, { recursive: true });

await esbuild.build({
  entryPoints: [join(projectRoot, "src", "preload", "index.ts")],
  bundle: true,
  platform: "node",
  target: "node18",
  outfile: join(outDir, "index.cjs"),
  sourcemap: true,
  format: "cjs",
  external: ["electron", "zod", "@ekm/shared-types"],
});

console.log("Preload build complete");