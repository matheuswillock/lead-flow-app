export class WhatsAppAutoResponseSendError extends Error {
  readonly providerMessageSent: boolean;
  readonly messageId?: string;

  constructor(
    message: string,
    options: { providerMessageSent: boolean; messageId?: string }
  ) {
    super(message);
    this.name = "WhatsAppAutoResponseSendError";
    this.providerMessageSent = options.providerMessageSent;
    this.messageId = options.messageId;
  }
}

export function isWhatsAppAutoResponseSendError(
  error: unknown
): error is WhatsAppAutoResponseSendError {
  return error instanceof WhatsAppAutoResponseSendError;
}
