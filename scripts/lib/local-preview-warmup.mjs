import { performance } from "node:perf_hooks";

const DEFAULT_ROUTES = ["/entrar", "/"];
const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1"]);

function wait(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function requestRoute(url) {
  for (let attempt = 1; attempt <= 40; attempt += 1) {
    try {
      const response = await fetch(url, {
        cache: "no-store",
        headers: { "x-collab-local-warmup": "1" },
        redirect: "manual",
        signal: AbortSignal.timeout(120_000),
      });
      await response.arrayBuffer();
      if (response.status < 500) return response.status;
    } catch {
      if (attempt === 40) throw new Error("Servidor local indisponível.");
    }
    await wait(Math.min(100 * attempt, 1_000));
  }
  throw new Error("Servidor local indisponível.");
}

export async function warmLocalPreview({
  baseUrl = "http://127.0.0.1:3000",
  routes = DEFAULT_ROUTES,
} = {}) {
  const parsedBaseUrl = new URL(baseUrl);
  if (!LOCAL_HOSTS.has(parsedBaseUrl.hostname)) {
    throw new Error("O aquecimento aceita somente servidor local.");
  }
  if (routes.some((route) => !route.startsWith("/"))) {
    throw new Error("O aquecimento aceita somente rotas internas.");
  }

  const startedAt = performance.now();
  const warmed = [];
  for (const route of routes) {
    warmed.push({
      route,
      status: await requestRoute(new URL(route, parsedBaseUrl)),
    });
  }

  return {
    routes: warmed,
    totalMs: Number((performance.now() - startedAt).toFixed(2)),
  };
}
