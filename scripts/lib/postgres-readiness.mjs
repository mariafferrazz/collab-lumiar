import { createConnection } from "node:net";

import postgres from "postgres";

const DEFAULT_RETRY_DELAYS_MS = [0, 100, 200, 400, 800, 1200, 1600, 2000];
const ALLOWED_PUBLISHED_HOSTS = new Set(["127.0.0.1", "localhost", "::1"]);

function delay(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function parsePublishedEndpointLine(line) {
  const match = /^(?:\[([^\]]+)\]|([^:]+)):(\d+)$/.exec(line.trim());

  if (!match) {
    return null;
  }

  const host = (match[1] ?? match[2] ?? "").toLowerCase();
  const port = Number(match[3]);

  if (
    !ALLOWED_PUBLISHED_HOSTS.has(host) ||
    !Number.isInteger(port) ||
    port < 1 ||
    port > 65_535
  ) {
    return null;
  }

  return { host, port };
}

export function parsePublishedPostgresEndpoint(output) {
  const endpoints = output
    .split(/\r?\n/u)
    .map(parsePublishedEndpointLine)
    .filter(Boolean);

  if (endpoints.length === 0) {
    throw new Error(
      "O Docker não informou uma porta PostgreSQL publicada em loopback.",
    );
  }

  const [endpoint] = endpoints;

  if (
    endpoints.some(
      (candidate) =>
        candidate.host !== endpoint.host || candidate.port !== endpoint.port,
    )
  ) {
    throw new Error("O Docker informou mapeamentos PostgreSQL ambíguos.");
  }

  return endpoint;
}

function tryTcpConnection(host, port) {
  return new Promise((resolve, reject) => {
    const socket = createConnection({ host, port });

    socket.setTimeout(1000);
    socket.once("connect", () => {
      socket.destroy();
      resolve(undefined);
    });
    socket.once("timeout", () => {
      socket.destroy();
      reject(new Error("TCP timeout"));
    });
    socket.once("error", (error) => {
      socket.destroy();
      reject(error);
    });
  });
}

export async function waitForPublishedTcp(
  host,
  port,
  retryDelaysMs = DEFAULT_RETRY_DELAYS_MS,
) {
  for (const [index, retryDelay] of retryDelaysMs.entries()) {
    await delay(retryDelay);

    try {
      await tryTcpConnection(host, port);
      return { attempts: index + 1 };
    } catch {
      if (index === retryDelaysMs.length - 1) {
        throw new Error(
          "A porta PostgreSQL publicada não ficou acessível no Windows.",
        );
      }
    }
  }

  throw new Error("A verificação TCP não foi concluída.");
}

export async function waitForPostgresSql(
  databaseUrl,
  retryDelaysMs = DEFAULT_RETRY_DELAYS_MS,
) {
  for (const [index, retryDelay] of retryDelaysMs.entries()) {
    await delay(retryDelay);
    const client = postgres(databaseUrl, {
      max: 1,
      prepare: false,
      connect_timeout: 2,
      idle_timeout: 1,
    });

    try {
      const rows = await client`
        SELECT
          1 AS ready,
          current_setting('server_version') AS version
      `;

      if (String(rows[0]?.ready) === "1" && rows[0]?.version) {
        return { attempts: index + 1, version: String(rows[0].version) };
      }
    } catch {
      if (index === retryDelaysMs.length - 1) {
        throw new Error(
          "O PostgreSQL publicado aceitou TCP, mas não respondeu ao teste SQL.",
        );
      }
    } finally {
      await client.end({ timeout: 1 }).catch(() => undefined);
    }
  }

  throw new Error("A verificação SQL não foi concluída.");
}
