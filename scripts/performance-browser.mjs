import { spawn } from "node:child_process";
import { once } from "node:events";
import { mkdtemp, rm } from "node:fs/promises";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { performance } from "node:perf_hooks";

const baseUrl = new URL(process.env.PERF_BASE_URL ?? "http://127.0.0.1:3000");
if (!new Set(["localhost", "127.0.0.1", "::1"]).has(baseUrl.hostname)) {
  throw new Error("O benchmark de navegador aceita somente servidor local.");
}

const browserExecutable = process.env.PERF_BROWSER_EXECUTABLE?.trim();
if (!browserExecutable) {
  throw new Error(
    "PERF_BROWSER_EXECUTABLE precisa apontar para Chrome ou Brave.",
  );
}

const navigationTimeoutMs = Number(
  process.env.PERF_NAVIGATION_TIMEOUT_MS ?? "15000",
);
if (
  !Number.isInteger(navigationTimeoutMs) ||
  navigationTimeoutMs < 5_000 ||
  navigationTimeoutMs > 300_000
) {
  throw new Error(
    "PERF_NAVIGATION_TIMEOUT_MS deve ser um inteiro entre 5000 e 300000.",
  );
}

function reservePort() {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (!address || typeof address === "string") {
        server.close();
        reject(new Error("Não foi possível reservar uma porta local."));
        return;
      }
      server.close((error) => (error ? reject(error) : resolve(address.port)));
    });
  });
}

async function waitForEndpoint(url, timeoutMs = 10_000) {
  const startedAt = performance.now();
  let lastError;
  while (performance.now() - startedAt < timeoutMs) {
    try {
      const response = await fetch(url);
      if (response.ok) return response;
    } catch (error) {
      lastError = error;
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error("O navegador headless não ficou pronto.", {
    cause: lastError,
  });
}

function createCdpClient(webSocketUrl) {
  const socket = new WebSocket(webSocketUrl);
  let commandId = 0;
  const pending = new Map();
  const eventWaiters = new Map();

  socket.addEventListener("message", (event) => {
    const message = JSON.parse(event.data);
    if (message.id) {
      const request = pending.get(message.id);
      pending.delete(message.id);
      if (!request) return;
      if (message.error) request.reject(new Error(message.error.message));
      else request.resolve(message.result);
      return;
    }
    const waiters = eventWaiters.get(message.method) ?? [];
    eventWaiters.delete(message.method);
    for (const resolve of waiters) resolve(message.params);
  });

  const opened = new Promise((resolve, reject) => {
    socket.addEventListener("open", resolve, { once: true });
    socket.addEventListener("error", reject, { once: true });
  });

  return {
    async send(method, params = {}) {
      await opened;
      const id = ++commandId;
      return new Promise((resolve, reject) => {
        pending.set(id, { resolve, reject });
        socket.send(JSON.stringify({ id, method, params }));
      });
    },
    waitFor(method, timeoutMs = 15_000) {
      return new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
          reject(new Error(`Tempo excedido aguardando ${method}.`));
        }, timeoutMs);
        const waiters = eventWaiters.get(method) ?? [];
        waiters.push((params) => {
          clearTimeout(timer);
          resolve(params);
        });
        eventWaiters.set(method, waiters);
      });
    },
    close() {
      socket.close();
    },
  };
}

const observerSource = `
  window.__collabPerformance = { lcp: 0, cls: 0, inp: null };
  new PerformanceObserver((list) => {
    const entries = list.getEntries();
    const last = entries.at(-1);
    if (last) window.__collabPerformance.lcp = last.startTime;
  }).observe({ type: "largest-contentful-paint", buffered: true });
  new PerformanceObserver((list) => {
    for (const entry of list.getEntries()) {
      if (!entry.hadRecentInput) window.__collabPerformance.cls += entry.value;
    }
  }).observe({ type: "layout-shift", buffered: true });
  try {
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        window.__collabPerformance.inp = Math.max(
          window.__collabPerformance.inp ?? 0,
          entry.duration,
        );
      }
    }).observe({ type: "event", buffered: true, durationThreshold: 16 });
  } catch {}
`;

const resultExpression = `JSON.stringify((() => {
  const navigation = performance.getEntriesByType("navigation")[0];
  const resources = performance.getEntriesByType("resource");
  const javascript = resources.filter((entry) =>
    /\\.js(?:\\?|$)/.test(entry.name),
  );
  const images = resources.filter(
    (entry) =>
      entry.initiatorType === "img" ||
      /\\/_next\\/image\\?|\\.(?:avif|gif|jpe?g|png|webp)(?:\\?|$)/.test(entry.name),
  );
  const paints = Object.fromEntries(
    performance.getEntriesByType("paint").map((entry) => [entry.name, entry.startTime]),
  );
  return {
    navigation: navigation ? {
      ttfbMs: navigation.responseStart,
      domContentLoadedMs: navigation.domContentLoadedEventEnd,
      loadMs: navigation.loadEventEnd,
      transferBytes: navigation.transferSize,
      encodedBytes: navigation.encodedBodySize,
      decodedBytes: navigation.decodedBodySize,
    } : null,
    fcpMs: paints["first-contentful-paint"] ?? null,
    lcpMs: window.__collabPerformance?.lcp ?? null,
    cls: window.__collabPerformance?.cls ?? null,
    inpMs: window.__collabPerformance?.inp ?? null,
    requests: resources.length + 1,
    javascript: {
      requests: javascript.length,
      transferBytes: javascript.reduce((sum, entry) => sum + entry.transferSize, 0),
      encodedBytes: javascript.reduce((sum, entry) => sum + entry.encodedBodySize, 0),
    },
    images: {
      requests: images.length,
      transferBytes: images.reduce((sum, entry) => sum + entry.transferSize, 0),
      encodedBytes: images.reduce((sum, entry) => sum + entry.encodedBodySize, 0),
    },
  };
})())`;

const profileDirectory = await mkdtemp(join(tmpdir(), "collab-perf-browser-"));
const port = await reservePort();
const browser = spawn(
  browserExecutable,
  [
    "--headless=new",
    "--disable-background-networking",
    "--disable-component-update",
    "--disable-default-apps",
    "--disable-extensions",
    "--disable-sync",
    "--metrics-recording-only",
    "--no-first-run",
    `--remote-debugging-port=${port}`,
    `--user-data-dir=${profileDirectory}`,
    "about:blank",
  ],
  { stdio: "ignore", windowsHide: true },
);

let client;
try {
  await waitForEndpoint(`http://127.0.0.1:${port}/json/version`);
  const pageResponse = await fetch(
    `http://127.0.0.1:${port}/json/new?about:blank`,
    { method: "PUT" },
  );
  const page = await pageResponse.json();
  client = createCdpClient(page.webSocketDebuggerUrl);
  await Promise.all([
    client.send("Page.enable"),
    client.send("Runtime.enable"),
    client.send("Network.enable"),
  ]);
  await client.send("Page.addScriptToEvaluateOnNewDocument", {
    source: observerSource,
  });

  const samples = [];
  for (let sample = 1; sample <= 5; sample += 1) {
    await client.send("Network.setCacheDisabled", {
      cacheDisabled: sample === 1,
    });
    const loaded = client.waitFor("Page.loadEventFired", navigationTimeoutMs);
    await client.send("Page.navigate", {
      url: new URL("/", baseUrl).toString(),
    });
    await loaded;
    await new Promise((resolve) => setTimeout(resolve, 1_000));
    const evaluation = await client.send("Runtime.evaluate", {
      expression: resultExpression,
      returnByValue: true,
    });
    samples.push({ sample, ...JSON.parse(evaluation.result.value) });
  }

  console.log(
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        url: new URL("/", baseUrl).toString(),
        note: "INP permanece nulo sem uma interação representativa.",
        samples,
      },
      null,
      2,
    ),
  );
} finally {
  if (client) {
    await client.send("Browser.close").catch(() => undefined);
    client.close();
  }
  await Promise.race([
    once(browser, "exit"),
    new Promise((resolve) => setTimeout(resolve, 2_000)),
  ]);
  if (browser.exitCode === null) {
    browser.kill();
    await Promise.race([
      once(browser, "exit"),
      new Promise((resolve) => setTimeout(resolve, 2_000)),
    ]);
  }
  await rm(profileDirectory, {
    recursive: true,
    force: true,
    maxRetries: 5,
    retryDelay: 100,
  });
}
