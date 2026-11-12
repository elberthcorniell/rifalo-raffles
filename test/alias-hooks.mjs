import { existsSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

let root = "";

export function initialize(data) {
  root = fileURLToPath(data.root);
}

export async function resolve(specifier, context, nextResolve) {
  if (specifier.startsWith("@/")) {
    const base = join(root, "src", specifier.slice(2));
    const file = existsSync(`${base}.ts`)
      ? `${base}.ts`
      : existsSync(`${base}.tsx`)
        ? `${base}.tsx`
        : base;
    return nextResolve(pathToFileURL(file).href, context);
  }
  return nextResolve(specifier, context);
}
