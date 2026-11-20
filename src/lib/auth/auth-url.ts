const LOOPBACK_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]", "::1"]);
const REDIRECT_QUERY_PARAMETERS = [
  "callbackURL",
  "redirectTo",
  "errorCallbackURL",
  "newUserCallbackURL",
] as const;

function containsControlCharacter(value: string): boolean {
  return Array.from(value).some((character) => {
    const code = character.codePointAt(0) ?? 0;
    return code <= 31 || code === 127;
  });
}

export function normalizeAuthOrigin(
  value: string,
  options: { allowLocalHttp: boolean },
): string {
  const url = new URL(value);
  const isLoopback = LOOPBACK_HOSTS.has(url.hostname.toLowerCase());
  const protocolAllowed =
    url.protocol === "https:" ||
    (options.allowLocalHttp && url.protocol === "http:" && isLoopback);

  if (
    !protocolAllowed ||
    url.username ||
    url.password ||
    (url.pathname !== "/" && url.pathname !== "") ||
    url.search ||
    url.hash
  ) {
    throw new Error("A origem da autenticação é inválida.");
  }

  return url.origin;
}

function assertTrustedRedirectTarget(value: string, trustedOrigin: string) {
  if (
    value.startsWith("/") &&
    !value.startsWith("//") &&
    !value.includes("\\") &&
    !containsControlCharacter(value)
  ) {
    return;
  }

  const absolute = new URL(value);

  if (absolute.origin !== trustedOrigin) {
    throw new Error("Um redirecionamento do e-mail foi rejeitado.");
  }
}

export function assertTrustedAuthActionUrl(
  value: string,
  trustedOrigin: string,
): URL {
  const expectedOrigin = normalizeAuthOrigin(trustedOrigin, {
    allowLocalHttp: true,
  });
  const actionUrl = new URL(value);

  if (
    actionUrl.origin !== expectedOrigin ||
    !new Set(["http:", "https:"]).has(actionUrl.protocol) ||
    actionUrl.username ||
    actionUrl.password
  ) {
    throw new Error("A URL da mensagem de autenticação foi rejeitada.");
  }

  for (const parameter of REDIRECT_QUERY_PARAMETERS) {
    for (const redirectTarget of actionUrl.searchParams.getAll(parameter)) {
      assertTrustedRedirectTarget(redirectTarget, expectedOrigin);
    }
  }

  return actionUrl;
}
