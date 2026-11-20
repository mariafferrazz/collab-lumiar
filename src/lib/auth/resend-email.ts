import {
  assertTrustedAuthActionUrl,
  normalizeAuthOrigin,
} from "@/lib/auth/auth-url";
import type { AuthEmailTransport } from "@/lib/auth/email";
import { renderAuthEmail } from "@/lib/auth/email-templates";

const EMAIL_PATTERN = /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/u;

export interface ResendEmailConfigurationInput {
  provider?: string;
  from?: string;
  apiKey?: string;
  baseURL?: string;
  nodeEnvironment?: string;
}

export interface ResendEmailConfiguration {
  from: string;
  apiKey: string;
  trustedOrigin: string;
}

export interface ResendEmailClient {
  emails: {
    send(message: {
      from: string;
      to: string;
      subject: string;
      html: string;
      text: string;
    }): Promise<{ data: unknown | null; error: unknown | null }>;
  };
}

export type AuthEmailTaskScheduler = (task: () => Promise<void>) => void;

function readSenderAddress(value: string): string {
  const bracketMatch = value.match(/<([^<>]+)>$/u);
  return (bracketMatch?.[1] ?? value).trim();
}

export function resolveResendEmailConfiguration(
  input: ResendEmailConfigurationInput,
): ResendEmailConfiguration {
  const provider = input.provider?.trim().toLowerCase();
  const from = input.from?.trim();
  const apiKey = input.apiKey?.trim();
  const baseURL = input.baseURL?.trim();

  if (
    provider !== "resend" ||
    !from ||
    from.length > 320 ||
    /[\r\n]/u.test(from) ||
    !EMAIL_PATTERN.test(readSenderAddress(from)) ||
    !apiKey ||
    !baseURL
  ) {
    throw new Error(
      "O serviço de e-mail da autenticação não está configurado.",
    );
  }

  return {
    from,
    apiKey,
    trustedOrigin: normalizeAuthOrigin(baseURL, {
      allowLocalHttp: input.nodeEnvironment !== "production",
    }),
  };
}

export function createResendAuthEmailTransport(options: {
  configuration: ResendEmailConfiguration;
  client: ResendEmailClient;
  schedule: AuthEmailTaskScheduler;
  onDeliveryFailure: () => void;
}): AuthEmailTransport {
  return {
    async send(message) {
      const actionUrl = assertTrustedAuthActionUrl(
        message.actionUrl,
        options.configuration.trustedOrigin,
      );
      const content = renderAuthEmail({
        ...message,
        actionUrl: actionUrl.toString(),
      });

      options.schedule(async () => {
        try {
          const result = await options.client.emails.send({
            from: options.configuration.from,
            to: message.recipient,
            subject: content.subject,
            html: content.html,
            text: content.text,
          });

          if (result.error) {
            options.onDeliveryFailure();
          }
        } catch {
          options.onDeliveryFailure();
        }
      });
    },
  };
}
