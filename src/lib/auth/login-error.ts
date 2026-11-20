export interface SafeAuthLoginError {
  code: string | null;
  status: number | null;
  statusText: string | null;
}

const GENERIC_LOGIN_MESSAGE =
  "Não foi possível entrar. Confira os dados e a verificação do e-mail.";

export function readSafeAuthLoginError(error: unknown): SafeAuthLoginError {
  if (!error || typeof error !== "object") {
    return { code: null, status: null, statusText: null };
  }

  const candidate = error as Record<string, unknown>;

  return {
    code: typeof candidate.code === "string" ? candidate.code : null,
    status: typeof candidate.status === "number" ? candidate.status : null,
    statusText:
      typeof candidate.statusText === "string" ? candidate.statusText : null,
  };
}

export function getAuthLoginMessage(error: unknown): string {
  const diagnostic = readSafeAuthLoginError(error);

  if (diagnostic.code === "INVALID_ORIGIN") {
    return "Endereço local não autorizado. Abra http://localhost:3000/entrar e tente novamente.";
  }

  if (diagnostic.status === 429) {
    return "Muitas tentativas. Aguarde um minuto e tente novamente.";
  }

  if (
    diagnostic.code === "INVALID_EMAIL_OR_PASSWORD" ||
    diagnostic.code === "EMAIL_NOT_VERIFIED"
  ) {
    return GENERIC_LOGIN_MESSAGE;
  }

  if (diagnostic.code === "FAILED_TO_CREATE_SESSION") {
    return "Não foi possível criar a sessão. Tente novamente.";
  }

  return "Não foi possível entrar agora. Tente novamente mais tarde.";
}
