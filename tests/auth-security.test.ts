import assert from "node:assert/strict";
import test from "node:test";
import { NextRequest } from "next/server";

import { MemoryAuthEmailTransport } from "@/lib/auth/email";
import {
  AUTH_ROLES,
  hasAdminRole,
  readAuthRoles,
} from "@/lib/auth/permissions";
import {
  normalizeInternalRedirect,
  validateRegistrationInput,
} from "@/lib/auth/validation";
import { proxy } from "@/proxy";

const validTestPassword = "uma-senha-segura-2026"; // gitleaks:allow -- fixture local, sem valor real.
const differentTestPassword = "outra-senha-segura-2026"; // gitleaks:allow -- fixture local, sem valor real.

test("valida e normaliza um cadastro de cliente", () => {
  const result = validateRegistrationInput({
    name: "  Maria   da Serra  ",
    email: " MARIA@EXAMPLE.COM ",
    password: validTestPassword,
    passwordConfirmation: validTestPassword,
  });

  assert.deepEqual(result, {
    success: true,
    data: {
      name: "Maria da Serra",
      email: "maria@example.com",
      password: validTestPassword,
    },
  });
  assert.equal("role" in (result.success ? result.data : {}), false);
});

test("rejeita cadastro inválido sem retornar dados sensíveis", () => {
  const invalidEmail = validateRegistrationInput({
    name: "M",
    email: "invalido",
    password: "curta",
    passwordConfirmation: "diferente",
  });
  const mismatch = validateRegistrationInput({
    name: "Maria",
    email: "maria@example.com",
    password: validTestPassword,
    passwordConfirmation: differentTestPassword,
  });

  assert.equal(invalidEmail.success, false);
  assert.deepEqual(mismatch, {
    success: false,
    message: "As senhas não coincidem.",
  });
  assert.doesNotMatch(JSON.stringify([invalidEmail, mismatch]), /segura-2026/u);
});

test("aceita somente redirecionamentos internos", () => {
  assert.equal(
    normalizeInternalRedirect("/produtos?ordem=recentes#catalogo"),
    "/produtos?ordem=recentes#catalogo",
  );
  assert.equal(
    normalizeInternalRedirect("https://example.com"),
    "/minha-conta",
  );
  assert.equal(
    normalizeInternalRedirect("//example.com/admin"),
    "/minha-conta",
  );
  assert.equal(normalizeInternalRedirect("/\\example.com"), "/minha-conta");
  assert.equal(normalizeInternalRedirect("/admin\n"), "/minha-conta");
});

test("separa CUSTOMER de ADMIN sem promoção implícita", () => {
  assert.deepEqual(readAuthRoles("CUSTOMER"), [AUTH_ROLES.customer]);
  assert.equal(hasAdminRole("CUSTOMER"), false);
  assert.equal(hasAdminRole("ADMIN"), true);
  assert.equal(hasAdminRole("cliente@example.com"), false);
  assert.equal(hasAdminRole("CUSTOMER,ADMIN"), true);
});

test("redireciona acesso privado sem cookie de sessão", () => {
  const response = proxy(
    new NextRequest("https://collab.example/admin?origem=teste"),
  );

  assert.equal(response.status, 307);
  assert.equal(
    response.headers.get("location"),
    "https://collab.example/entrar?next=%2Fadmin",
  );
});

test("nega autorização administrativa ao papel CUSTOMER", () => {
  assert.equal(hasAdminRole(AUTH_ROLES.customer), false);
  assert.equal(hasAdminRole(AUTH_ROLES.admin), true);
});

test("transportador de teste mantém mensagens somente em memória", async () => {
  const transport = new MemoryAuthEmailTransport();
  await transport.send({
    purpose: "email-verification",
    recipient: "cliente@example.com",
    actionUrl: "http://127.0.0.1:3000/api/auth/verify-email?token=teste",
    expiresInSeconds: 3600,
  });

  assert.equal(transport.messages.length, 1);
  assert.equal(transport.messages[0]?.purpose, "email-verification");
  transport.clear();
  assert.equal(transport.messages.length, 0);
});
