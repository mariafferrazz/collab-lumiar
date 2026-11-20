export type AuthEmailPurpose = "email-verification" | "password-reset";

export interface AuthEmailMessage {
  purpose: AuthEmailPurpose;
  recipient: string;
  recipientName?: string;
  actionUrl: string;
  expiresInSeconds: number;
}

export interface AuthEmailTransport {
  send(message: AuthEmailMessage): Promise<void>;
}

export class MemoryAuthEmailTransport implements AuthEmailTransport {
  readonly messages: AuthEmailMessage[] = [];

  async send(message: AuthEmailMessage): Promise<void> {
    this.messages.push(structuredClone(message));
  }

  clear(): void {
    this.messages.length = 0;
  }
}
