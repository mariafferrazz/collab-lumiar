import type { AuthEmailMessage } from "@/lib/auth/email";

export interface AuthEmailContent {
  subject: string;
  html: string;
  text: string;
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/gu, (character) => {
    const entities: Record<string, string> = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    };
    return entities[character] ?? character;
  });
}

function normalizeRecipientName(value: string | undefined): string {
  const normalized = value?.replace(/[\r\n\t]+/gu, " ").trim();
  return normalized ? normalized.slice(0, 160) : "cliente";
}

function formatExpiration(seconds: number): string {
  const minutes = Math.max(1, Math.ceil(seconds / 60));

  if (minutes % 60 === 0) {
    const hours = minutes / 60;
    return hours === 1 ? "1 hora" : `${hours} horas`;
  }

  return minutes === 1 ? "1 minuto" : `${minutes} minutos`;
}

export function renderAuthEmail(message: AuthEmailMessage): AuthEmailContent {
  const name = normalizeRecipientName(message.recipientName);
  const expiration = formatExpiration(message.expiresInSeconds);
  const isVerification = message.purpose === "email-verification";
  const subject = isVerification
    ? "Confirme seu e-mail — COLLAB LUMIAR"
    : "Redefina sua senha — COLLAB LUMIAR";
  const heading = isVerification
    ? "Confirme seu endereço de e-mail"
    : "Redefina sua senha";
  const explanation = isVerification
    ? "Confirme este endereço para ativar com segurança o acesso à sua conta."
    : "Recebemos uma solicitação para criar uma nova senha para sua conta.";
  const buttonLabel = isVerification
    ? "Confirmar meu e-mail"
    : "Redefinir minha senha";
  const ignoredRequest = isVerification
    ? "Se você não criou uma conta na COLLAB LUMIAR, ignore esta mensagem."
    : "Se você não solicitou a redefinição, ignore esta mensagem. Sua senha permanecerá inalterada.";
  const safeName = escapeHtml(name);
  const safeUrl = escapeHtml(message.actionUrl);

  const html = `<!doctype html>
<html lang="pt-BR">
  <head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head>
  <body style="margin:0;background:#f4e6d2;color:#302323;font-family:Arial,'Segoe UI',sans-serif;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f4e6d2;padding:24px 12px;">
      <tr><td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:600px;background:#fbf4e9;border:1px solid #d7bba3;border-radius:20px;overflow:hidden;">
          <tr><td style="background:#890e19;padding:28px 32px;color:#f4e6d2;text-align:center;">
            <p style="margin:0;font-family:Georgia,serif;font-size:30px;letter-spacing:3px;">COLLAB</p>
            <p style="margin:4px 0 0;font-size:13px;letter-spacing:5px;">LUMIAR</p>
          </td></tr>
          <tr><td style="padding:36px 32px;">
            <p style="margin:0 0 18px;font-size:16px;line-height:1.6;">Olá, ${safeName}.</p>
            <h1 style="margin:0 0 18px;color:#890e19;font-family:Georgia,serif;font-size:28px;line-height:1.25;">${heading}</h1>
            <p style="margin:0 0 24px;font-size:16px;line-height:1.7;">${explanation}</p>
            <p style="margin:0 0 26px;"><a href="${safeUrl}" style="display:inline-block;border-radius:999px;background:#890e19;color:#f4e6d2;padding:14px 22px;text-decoration:none;font-weight:700;">${buttonLabel}</a></p>
            <p style="margin:0 0 10px;font-size:14px;line-height:1.6;">Este link expira em ${expiration}.</p>
            <p style="margin:0 0 8px;font-size:13px;line-height:1.6;color:#6f5a55;">Se o botão não funcionar, copie e cole este endereço no navegador:</p>
            <p style="margin:0 0 24px;word-break:break-all;font-size:12px;line-height:1.6;"><a href="${safeUrl}" style="color:#890e19;">${safeUrl}</a></p>
            <p style="margin:0;padding-top:22px;border-top:1px solid #d7bba3;font-size:13px;line-height:1.6;color:#6f5a55;">${ignoredRequest}</p>
          </td></tr>
        </table>
      </td></tr>
    </table>
  </body>
</html>`;
  const text = `COLLAB LUMIAR

Olá, ${name}.

${heading}

${explanation}

${buttonLabel}: ${message.actionUrl}

Este link expira em ${expiration}.

${ignoredRequest}`;

  return { subject, html, text };
}
