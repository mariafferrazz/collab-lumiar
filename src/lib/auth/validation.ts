export const AUTH_PASSWORD_MIN_LENGTH = 12;
export const AUTH_PASSWORD_MAX_LENGTH = 128;
export const AUTH_NAME_MAX_LENGTH = 160;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/u;

export interface RegistrationInput {
  name: string;
  email: string;
  password: string;
  passwordConfirmation: string;
}

export interface ValidRegistrationInput {
  name: string;
  email: string;
  password: string;
}

export type ValidationResult<T> =
  | { success: true; data: T }
  | { success: false; message: string };

export function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

export function validateEmail(value: string): ValidationResult<string> {
  const email = normalizeEmail(value);

  if (email.length > 320 || !EMAIL_PATTERN.test(email)) {
    return { success: false, message: "Informe um e-mail válido." };
  }

  return { success: true, data: email };
}

export function validatePassword(value: string): ValidationResult<string> {
  if (
    value.length < AUTH_PASSWORD_MIN_LENGTH ||
    value.length > AUTH_PASSWORD_MAX_LENGTH
  ) {
    return {
      success: false,
      message: `Use uma senha entre ${AUTH_PASSWORD_MIN_LENGTH} e ${AUTH_PASSWORD_MAX_LENGTH} caracteres.`,
    };
  }

  return { success: true, data: value };
}

export function validateRegistrationInput(
  input: RegistrationInput,
): ValidationResult<ValidRegistrationInput> {
  const name = input.name.trim().replace(/\s+/gu, " ");

  if (name.length < 2 || name.length > AUTH_NAME_MAX_LENGTH) {
    return {
      success: false,
      message: `Informe um nome entre 2 e ${AUTH_NAME_MAX_LENGTH} caracteres.`,
    };
  }

  const email = validateEmail(input.email);

  if (!email.success) {
    return email;
  }

  const password = validatePassword(input.password);

  if (!password.success) {
    return password;
  }

  if (input.password !== input.passwordConfirmation) {
    return { success: false, message: "As senhas não coincidem." };
  }

  return {
    success: true,
    data: { name, email: email.data, password: password.data },
  };
}

export function normalizeInternalRedirect(
  candidate: string | null | undefined,
  fallback = "/minha-conta",
): string {
  const containsControlCharacter = candidate
    ? Array.from(candidate).some((character) => {
        const code = character.codePointAt(0) ?? 0;
        return code <= 31 || code === 127;
      })
    : false;

  if (
    !candidate?.startsWith("/") ||
    candidate.startsWith("//") ||
    candidate.includes("\\") ||
    containsControlCharacter
  ) {
    return fallback;
  }

  const parsed = new URL(candidate, "https://collab.invalid");

  if (parsed.origin !== "https://collab.invalid") {
    return fallback;
  }

  return `${parsed.pathname}${parsed.search}${parsed.hash}`;
}
