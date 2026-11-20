import { performance } from "node:perf_hooks";

import postgres from "postgres";

const DEFAULT_ROUTES = [
  "/",
  "/admin",
  "/admin/artistas",
  "/admin/categorias",
  "/admin/produtos",
  "/admin/estoque",
  "/admin/financeiro",
];

function percentile(values, fraction) {
  if (values.length === 0) return null;
  const sorted = [...values].sort((left, right) => left - right);
  const index = Math.min(
    sorted.length - 1,
    Math.floor((sorted.length - 1) * fraction),
  );
  return Number(sorted[index].toFixed(2));
}

function parseSamples() {
  const value = Number(process.env.PERF_SAMPLES ?? "5");
  if (!Number.isInteger(value) || value < 2 || value > 30) {
    throw new Error("PERF_SAMPLES deve ser um inteiro entre 2 e 30.");
  }
  return value;
}

function parseRoutes() {
  const configured = process.env.PERF_ROUTES?.split(",")
    .map((route) => route.trim())
    .filter(Boolean);
  const routes = configured?.length ? configured : DEFAULT_ROUTES;

  if (routes.some((route) => !route.startsWith("/"))) {
    throw new Error("Todas as rotas precisam ser internas.");
  }
  return routes;
}

async function measureRoutes() {
  const baseUrl = new URL(process.env.PERF_BASE_URL ?? "http://127.0.0.1:3000");
  if (!new Set(["localhost", "127.0.0.1", "::1"]).has(baseUrl.hostname)) {
    throw new Error("O benchmark aceita somente um servidor local.");
  }
  const samples = parseSamples();
  const cookie = process.env.PERF_AUTH_COOKIE;
  const headers = {
    accept: "text/html,application/xhtml+xml",
    "x-collab-performance-audit": "local",
    ...(cookie ? { cookie } : {}),
  };
  const results = [];

  for (const route of parseRoutes()) {
    const measurements = [];
    for (let sample = 1; sample <= samples; sample += 1) {
      const startedAt = performance.now();
      const response = await fetch(new URL(route, baseUrl), {
        cache: "no-store",
        headers,
        redirect: "manual",
      });
      const headersAt = performance.now();
      const body = await response.arrayBuffer();
      const finishedAt = performance.now();
      measurements.push({
        sample,
        status: response.status,
        ttfbMs: Number((headersAt - startedAt).toFixed(2)),
        totalMs: Number((finishedAt - startedAt).toFixed(2)),
        bytes: body.byteLength,
        location: response.headers.get("location") ?? undefined,
      });
    }

    const warm = measurements.slice(1);
    results.push({
      route,
      authenticated: Boolean(cookie),
      first: measurements[0],
      warmMedianTtfbMs: percentile(
        warm.map((measurement) => measurement.ttfbMs),
        0.5,
      ),
      warmP95TtfbMs: percentile(
        warm.map((measurement) => measurement.ttfbMs),
        0.95,
      ),
      warmMedianTotalMs: percentile(
        warm.map((measurement) => measurement.totalMs),
        0.5,
      ),
      measurements,
    });
  }
  return results;
}

async function measureDatabase() {
  const databaseUrl = process.env.PERF_DATABASE_URL ?? process.env.DATABASE_URL;
  if (!databaseUrl) return null;

  const parsed = new URL(databaseUrl);
  if (!new Set(["localhost", "127.0.0.1", "::1"]).has(parsed.hostname)) {
    throw new Error("O benchmark aceita somente PostgreSQL local.");
  }

  const sql = postgres(databaseUrl, {
    max: 1,
    prepare: false,
    connect_timeout: 5,
    idle_timeout: 5,
    onnotice: () => undefined,
  });
  const values = [];
  try {
    for (let sample = 1; sample <= 20; sample += 1) {
      const startedAt = performance.now();
      await sql.unsafe("SELECT 1");
      values.push(Number((performance.now() - startedAt).toFixed(2)));
    }
  } finally {
    await sql.end({ timeout: 2 });
  }

  return {
    samples: values.length,
    firstMs: values[0],
    warmMedianMs: percentile(values.slice(1), 0.5),
    warmP95Ms: percentile(values.slice(1), 0.95),
    maxMs: Number(Math.max(...values).toFixed(2)),
  };
}

const report = {
  generatedAt: new Date().toISOString(),
  routes: await measureRoutes(),
  database: await measureDatabase(),
};

console.log(JSON.stringify(report, null, 2));
