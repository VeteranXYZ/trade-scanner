import { existsSync, statSync } from "node:fs";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { build } from "esbuild";

const [, , entry, ...args] = process.argv;

if (!entry) {
  console.error("Usage: node scripts/run-ts.mjs <entry.ts> [...args]");
  process.exit(1);
}

const absEntry = path.resolve(process.cwd(), entry);
const outDir = path.join(process.cwd(), ".data", ".tmp");
const outfile = path.join(
  outDir,
  `${path.basename(entry, path.extname(entry))}-${Date.now()}.mjs`,
);

await mkdir(outDir, { recursive: true });
await build({
  entryPoints: [absEntry],
  outfile,
  bundle: true,
  platform: "node",
  format: "esm",
  target: "node24",
  packages: "external",
  plugins: [
    {
      name: "tsconfig-paths-lite",
      setup(buildApi) {
        buildApi.onResolve({ filter: /^@\// }, (request) => ({
          path: resolveTsPath(path.join(process.cwd(), "src", request.path.slice(2))),
        }));
      },
    },
  ],
});

process.argv = [process.argv[0], absEntry, ...args];
await import(pathToFileURL(outfile).href);

function resolveTsPath(basePath) {
  const candidates = [
    basePath,
    `${basePath}.ts`,
    `${basePath}.tsx`,
    `${basePath}.js`,
    `${basePath}.mjs`,
    path.join(basePath, "index.ts"),
    path.join(basePath, "index.tsx"),
  ];

  for (const candidate of candidates) {
    if (existsSync(candidate) && statSync(candidate).isFile()) {
      return candidate;
    }
  }

  return basePath;
}
