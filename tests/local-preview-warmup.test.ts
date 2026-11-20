import assert from "node:assert/strict";
import { createServer } from "node:http";
import { test } from "node:test";

import { warmLocalPreview } from "../scripts/lib/local-preview-warmup.mjs";

test("aquece somente rotas locais e consome as respostas", async () => {
  const requestedRoutes: string[] = [];
  const server = createServer((request, response) => {
    requestedRoutes.push(request.url ?? "");
    response.writeHead(200, { "content-type": "text/html" });
    response.end("<!doctype html><title>COLLAB local</title>");
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  assert.ok(address && typeof address !== "string");

  try {
    const result = await warmLocalPreview({
      baseUrl: `http://127.0.0.1:${address.port}`,
    });
    assert.deepEqual(requestedRoutes, ["/entrar", "/"]);
    assert.deepEqual(
      result.routes.map(({ route, status }) => ({ route, status })),
      [
        { route: "/entrar", status: 200 },
        { route: "/", status: 200 },
      ],
    );
  } finally {
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
  }
});

test("recusa destino fora de loopback", async () => {
  await assert.rejects(
    warmLocalPreview({ baseUrl: "https://example.com" }),
    /somente servidor local/u,
  );
});
