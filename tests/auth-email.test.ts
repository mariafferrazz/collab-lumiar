import assert from "node:assert/strict";
import test from "node:test";

import { renderAuthEmail } from "@/lib/auth/email-templates";
import {
  createResendAuthEmailTransport,
  type ResendEmailClient,
  resolveResendEmailConfiguration,
} from "@/lib/auth/resend-email";

const localBaseURL = "http://127.0.0.1:3000";
const safeTestKey = "local-test-key-not-a-real-credential"; // gitleaks:allow -- fixture local.

function validConfiguration() {
  return resolveResendEmailConfiguration({
    provider: "resend",
    from: "COLLAB LUMIAR <no-reply@example.com>",
    apiKey: safeTestKey,
    baseURL: localBaseURL,
    nodeEnvironment: "test",
  });
}

test("monta os e-mails de verificação em HTML e texto com identidade COLLAB", () => {
  const content = renderAuthEmail({
    purpose: "email-verification",
    recipient: "cliente@example.com",
    recipientName: "Maria & <COLLAB>",
    actionUrl: `${localBaseURL}/api/auth/verify-email?token=fixture`,
    expiresInSeconds: 3600,
  });

  assert.equal(content.subject, "Confirme seu e-mail — COLLAB LUMIAR");
  assert.match(content.html, /COLLAB/u);
  assert.match(content.html, /#890e19/u);
  assert.match(content.html, /Maria &amp; &lt;COLLAB&gt;/u);
  assert.doesNotMatch(content.html, /<img\b/iu);
  assert.match(content.html, /Este link expira em 1 hora/u);
  assert.match(content.text, /Confirmar meu e-mail:/u);
  assert.match(content.text, /ignore esta mensagem/iu);
});

test("monta o e-mail de redefinição sem incluir senhas", () => {
  const content = renderAuthEmail({
    purpose: "password-reset",
    recipient: "cliente@example.com",
    actionUrl: `${localBaseURL}/api/auth/reset-password/token-fixture`,
    expiresInSeconds: 1800,
  });

  assert.equal(content.subject, "Redefina sua senha — COLLAB LUMIAR");
  assert.match(content.html, /Redefinir minha senha/u);
  assert.match(content.text, /30 minutos/u);
  assert.doesNotMatch(`${content.html}${content.text}`, /senha-secreta/u);
});

test("falha de forma segura quando a configuração do provedor está ausente", () => {
  assert.throws(
    () => resolveResendEmailConfiguration({}),
    /serviço de e-mail da autenticação não está configurado/u,
  );
  assert.throws(
    () =>
      resolveResendEmailConfiguration({
        provider: "resend",
        from: "no-reply@example.com",
        baseURL: localBaseURL,
      }),
    /serviço de e-mail da autenticação não está configurado/u,
  );
});

test("exige HTTPS publicamente e permite HTTP somente em loopback local", () => {
  assert.equal(validConfiguration().trustedOrigin, localBaseURL);
  assert.throws(
    () =>
      resolveResendEmailConfiguration({
        provider: "resend",
        from: "no-reply@example.com",
        apiKey: safeTestKey,
        baseURL: "http://collab.example",
        nodeEnvironment: "production",
      }),
    /origem da autenticação é inválida/u,
  );
  assert.equal(
    resolveResendEmailConfiguration({
      provider: "resend",
      from: "no-reply@example.com",
      apiKey: safeTestKey,
      baseURL: "https://collab.example",
      nodeEnvironment: "production",
    }).trustedOrigin,
    "https://collab.example",
  );
});

test("usa transporte falso sem realizar envio externo", async () => {
  const scheduled: Array<() => Promise<void>> = [];
  const sent: Array<Record<string, string>> = [];
  const client: ResendEmailClient = {
    emails: {
      async send(message) {
        sent.push(message);
        return { data: { id: "local-only" }, error: null };
      },
    },
  };
  const transport = createResendAuthEmailTransport({
    configuration: validConfiguration(),
    client,
    schedule: (task) => scheduled.push(task),
    onDeliveryFailure: () =>
      assert.fail("O transporte falso não deveria falhar."),
  });

  await transport.send({
    purpose: "email-verification",
    recipient: "cliente@example.com",
    actionUrl: `${localBaseURL}/api/auth/verify-email?token=fixture&callbackURL=%2Fverificar-email`,
    expiresInSeconds: 3600,
  });

  assert.equal(sent.length, 0);
  assert.equal(scheduled.length, 1);
  await scheduled[0]?.();
  assert.equal(sent.length, 1);
  assert.equal(sent[0]?.to, "cliente@example.com");
  assert.equal(sent[0]?.subject, "Confirme seu e-mail — COLLAB LUMIAR");
});

test("trata indisponibilidade do provedor sem expor erro nem token", async () => {
  const scheduled: Array<() => Promise<void>> = [];
  let failures = 0;
  const client: ResendEmailClient = {
    emails: {
      async send() {
        throw new Error("provider-secret-token=must-not-reach-callback");
      },
    },
  };
  const transport = createResendAuthEmailTransport({
    configuration: validConfiguration(),
    client,
    schedule: (task) => scheduled.push(task),
    onDeliveryFailure: () => {
      failures += 1;
    },
  });

  await transport.send({
    purpose: "password-reset",
    recipient: "cliente@example.com",
    actionUrl: `${localBaseURL}/api/auth/reset-password/provider-token-fixture`,
    expiresInSeconds: 3600,
  });
  await scheduled[0]?.();

  assert.equal(failures, 1);
});

test("rejeita links externos e open redirect antes de agendar o envio", async () => {
  let scheduled = false;
  const client: ResendEmailClient = {
    emails: {
      async send() {
        return { data: null, error: null };
      },
    },
  };
  const transport = createResendAuthEmailTransport({
    configuration: validConfiguration(),
    client,
    schedule: () => {
      scheduled = true;
    },
    onDeliveryFailure: () => undefined,
  });
  const baseMessage = {
    purpose: "email-verification" as const,
    recipient: "cliente@example.com",
    expiresInSeconds: 3600,
  };

  await assert.rejects(
    transport.send({
      ...baseMessage,
      actionUrl: "https://evil.example/verify?token=fixture",
    }),
    /URL da mensagem de autenticação foi rejeitada/u,
  );
  await assert.rejects(
    transport.send({
      ...baseMessage,
      actionUrl: `${localBaseURL}/api/auth/verify-email?token=fixture&callbackURL=${encodeURIComponent("https://evil.example")}`,
    }),
    /redirecionamento do e-mail foi rejeitado/u,
  );
  assert.equal(scheduled, false);
});
