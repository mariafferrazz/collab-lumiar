import assert from "node:assert/strict";
import test from "node:test";

import {
  getAuthLoginMessage,
  readSafeAuthLoginError,
} from "@/lib/auth/login-error";

test("preserva resposta neutra para credencial inválida e e-mail não verificado", () => {
  const invalidCredentials = getAuthLoginMessage({
    code: "INVALID_EMAIL_OR_PASSWORD",
    status: 401,
  });
  const unverifiedEmail = getAuthLoginMessage({
    code: "EMAIL_NOT_VERIFIED",
    status: 403,
  });

  assert.equal(invalidCredentials, unverifiedEmail);
  assert.equal(
    invalidCredentials,
    "Não foi possível entrar. Confira os dados e a verificação do e-mail.",
  );
});

test("orienta a origem local canônica quando Better Auth rejeita a origem", () => {
  assert.equal(
    getAuthLoginMessage({ code: "INVALID_ORIGIN", status: 403 }),
    "Endereço local não autorizado. Abra http://localhost:3000/entrar e tente novamente.",
  );
});

test("distingue limite de tentativas e falha de criação de sessão", () => {
  assert.match(getAuthLoginMessage({ status: 429 }), /Aguarde um minuto/u);
  assert.equal(
    getAuthLoginMessage({ code: "FAILED_TO_CREATE_SESSION", status: 401 }),
    "Não foi possível criar a sessão. Tente novamente.",
  );
});

test("diagnóstico seguro descarta campos sensíveis e desconhecidos", () => {
  const diagnostic = readSafeAuthLoginError({
    code: "INVALID_EMAIL_OR_PASSWORD",
    status: 401,
    statusText: "UNAUTHORIZED",
    email: "nao-deve-ser-copiado@example.invalid",
    password: "nao-deve-ser-copiada",
    token: "nao-deve-ser-copiado",
  });

  assert.deepEqual(diagnostic, {
    code: "INVALID_EMAIL_OR_PASSWORD",
    status: 401,
    statusText: "UNAUTHORIZED",
  });
  assert.doesNotMatch(JSON.stringify(diagnostic), /password|token|example/u);
});
