// Loads the app's .ts/.tsx modules in Node's test runner with no new packages: each file is
// transpiled with TypeScript into node_modules/.cache, so "react" resolves, and relative
// imports listed in `stubs` are replaced by the given source.
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import ts from "typescript";

const root = fileURLToPath(new URL("../", import.meta.url));
const env = JSON.stringify({ VITE_API_URL: "http://test.invalid" });

async function exists(path) {
  try {
    await readFile(path);
    return true;
  } catch {
    return false;
  }
}

export async function tsxLoader(stubs = {}) {
  const cache = join(root, "node_modules", ".cache");
  await mkdir(cache, { recursive: true });
  const outDir = await mkdtemp(join(cache, "tsx-test-"));
  const compiled = new Map();

  async function compile(path) {
    if (compiled.has(path)) return compiled.get(path);
    const target = join(outDir, `${compiled.size}.mjs`);
    compiled.set(path, target);
    const source = (await readFile(path, "utf8")).replaceAll("import.meta.env", `(${env})`);
    let output = ts.transpileModule(source, {
      compilerOptions: {
        target: ts.ScriptTarget.ES2022,
        module: ts.ModuleKind.ESNext,
        jsx: ts.JsxEmit.ReactJSX,
        verbatimModuleSyntax: false,
      },
    }).outputText;
    for (const [, spec] of output.matchAll(/from\s+["'](\.{1,2}\/[^"']+)["']/g)) {
      let file;
      if (stubs[spec]) {
        file = join(outDir, `stub-${spec.replace(/\W/g, "")}.mjs`);
        await writeFile(file, stubs[spec]);
      } else {
        const base = resolve(dirname(path), spec);
        let source = base;
        for (const candidate of [`${base}.ts`, `${base}.tsx`]) {
          if (await exists(candidate)) {
            source = candidate;
            break;
          }
        }
        file = await compile(source);
      }
      output = output.replaceAll(`"${spec}"`, JSON.stringify(pathToFileURL(file).href));
    }
    await writeFile(target, output);
    return target;
  }

  return {
    load: async (relative) => import(pathToFileURL(await compile(join(root, relative))).href),
    cleanup: () => rm(outDir, { recursive: true, force: true }),
  };
}
