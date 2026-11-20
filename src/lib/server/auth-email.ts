import "server-only";

import { after } from "next/server";
import { Resend } from "resend";

import type { AuthEmailTransport } from "@/lib/auth/email";
import { createResendAuthEmailTransport } from "@/lib/auth/resend-email";
import { readResendEmailConfiguration } from "@/lib/server/auth-settings";

const DELIVERY_FAILURE_LOG =
  "[auth-email] O provedor não confirmou a aceitação da mensagem.";
const CONFIGURATION_FAILURE_LOG =
  "[auth-email] O serviço de e-mail não está disponível.";

export const configuredAuthEmailTransport: AuthEmailTransport = {
  async send(message) {
    let configuration: ReturnType<typeof readResendEmailConfiguration>;

    try {
      configuration = readResendEmailConfiguration();
    } catch {
      console.error(CONFIGURATION_FAILURE_LOG);
      return;
    }

    const transport = createResendAuthEmailTransport({
      configuration,
      client: new Resend(configuration.apiKey),
      schedule: (task) => after(task),
      onDeliveryFailure: () => console.error(DELIVERY_FAILURE_LOG),
    });

    await transport.send(message);
  },
};
