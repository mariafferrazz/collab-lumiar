import assert from "node:assert/strict";
import { createServer } from "node:net";
import test from "node:test";

import {
  parsePublishedPostgresEndpoint,
  waitForPublishedTcp,
} from "../scripts/lib/postgres-readiness.mjs";

test("interpreta a porta efetivamente publicada pelo Docker Compose", () => {
  assert.deepEqual(parsePublishedPostgresEndpoint("127.0.0.1:64186\n"), {
    host: "127.0.0.1",
    port: 64_186,
  });
  assert.deepEqual(parsePublishedPostgresEndpoint("[::1]:54321\n"), {
    host: "::1",
    port: 54_321,
  });
});

test("rejeita publicação pública, ausente ou ambígua", () => {
  assert.throws(() => parsePublishedPostgresEndpoint("0.0.0.0:5432\n"));
  assert.throws(() => parsePublishedPostgresEndpoint(""));
  assert.throws(() =>
    parsePublishedPostgresEndpoint("127.0.0.1:5432\n127.0.0.1:5433\n"),
  );
});

test("confirma uma porta TCP realmente acessível", async () => {
  const server = createServer((socket) => socket.destroy());

  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });

  try {
    const address = server.address();
    assert.ok(address && typeof address !== "string");
    const readiness = await waitForPublishedTcp("127.0.0.1", address.port, [0]);
    assert.equal(readiness.attempts, 1);
  } finally {
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
  }
});
