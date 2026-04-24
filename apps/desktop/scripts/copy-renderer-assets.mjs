import { mkdir, copyFile } from "node:fs/promises";
import { join } from "node:path";

const projectRoot = process.cwd();
const sourceDir = join(projectRoot, "src", "renderer");
const targetDir = join(projectRoot, "dist", "renderer");

await mkdir(targetDir, { recursive: true });
await copyFile(join(sourceDir, "index.html"), join(targetDir, "index.html"));
await copyFile(join(sourceDir, "styles.css"), join(targetDir, "styles.css"));
