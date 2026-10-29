import { cp, mkdir } from "node:fs/promises";
import { join } from "node:path";

const projectRoot = process.cwd();
const source = join(projectRoot, "node_modules", "mathlive", "fonts");
const destination = join(projectRoot, "public", "mathlive-fonts");

await mkdir(destination, { recursive: true });
await cp(source, destination, { recursive: true, force: true });
