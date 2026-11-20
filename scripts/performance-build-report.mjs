import { readdir, readFile, stat } from "node:fs/promises";
import { basename, join, resolve, sep } from "node:path";
import { gzipSync } from "node:zlib";

const requestedDistDir = process.env.PERF_DIST_DIR?.trim();

if (
  !requestedDistDir ||
  !/^\.next-performance-[a-z0-9-]+$/.test(requestedDistDir)
) {
  throw new Error(
    "PERF_DIST_DIR deve usar o formato .next-performance-<nome>.",
  );
}

const projectRoot = process.cwd();
const distDir = resolve(projectRoot, requestedDistDir);
if (!distDir.startsWith(`${projectRoot}${sep}`)) {
  throw new Error("O diretório de build precisa permanecer dentro do projeto.");
}

const ROUTE_HTML = [
  ["/", "server/app/index.html"],
  ["/entrar", "server/app/entrar.html"],
  ["/produtos", "server/app/produtos.html"],
  ["/artistas", "server/app/artistas.html"],
  ["/admin (shell PPR)", "server/app/admin.html"],
];

const chunkPattern = /\/_next\/(static\/chunks\/[^"?]+\.(?:js|css))/g;

async function fileSizes(relativePaths) {
  const result = {
    javascript: { rawBytes: 0, gzipBytes: 0 },
    css: { rawBytes: 0, gzipBytes: 0 },
  };

  for (const relativePath of relativePaths) {
    const contents = await readFile(join(distDir, relativePath));
    const target = relativePath.endsWith(".js")
      ? result.javascript
      : result.css;
    target.rawBytes += contents.byteLength;
    target.gzipBytes += gzipSync(contents, { level: 9 }).byteLength;
  }

  return result;
}

async function routeReport([route, relativeHtmlPath]) {
  const html = await readFile(join(distDir, relativeHtmlPath), "utf8");
  const chunks = [
    ...new Set(Array.from(html.matchAll(chunkPattern), (match) => match[1])),
  ];
  const sizes = await fileSizes(chunks);
  return {
    route,
    requests: chunks.length + 1,
    html: {
      rawBytes: Buffer.byteLength(html),
      gzipBytes: gzipSync(Buffer.from(html), { level: 9 }).byteLength,
    },
    ...sizes,
    chunks,
  };
}

async function listFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const absolutePath = join(directory, entry.name);
    if (entry.isDirectory()) files.push(...(await listFiles(absolutePath)));
    else if (entry.isFile()) files.push(absolutePath);
  }
  return files;
}

const chunkDirectory = join(distDir, "static", "chunks");
const chunks = await Promise.all(
  (await listFiles(chunkDirectory)).map(async (absolutePath) => ({
    file: absolutePath
      .slice(distDir.length + 1)
      .split(sep)
      .join("/"),
    bytes: (await stat(absolutePath)).size,
  })),
);

const report = {
  generatedAt: new Date().toISOString(),
  buildId: (await readFile(join(distDir, "BUILD_ID"), "utf8")).trim(),
  distDir: basename(distDir),
  routes: await Promise.all(ROUTE_HTML.map(routeReport)),
  chunks: {
    count: chunks.length,
    totalBytes: chunks.reduce((total, chunk) => total + chunk.bytes, 0),
    largest: chunks
      .sort((left, right) => right.bytes - left.bytes)
      .slice(0, 10),
  },
};

console.log(JSON.stringify(report, null, 2));
