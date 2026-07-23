export interface BackofficeEvoQrCode {
  text: string;
  base64: string;
}

export interface BackofficeEvoConnectResult {
  instanceName: string;
  status: "open" | "close" | "connecting";
  qrCode: BackofficeEvoQrCode | null;
  /** Dígitos do WhatsApp conectado (ownerJid), quando disponível. */
  phoneNumber?: string | null;
}

export interface IBackofficeEvoApiService {
  connectInstance(params: {
    instanceName: string;
    webhookUrl: string;
  }): Promise<BackofficeEvoConnectResult>;
  setWebhook(params: { instanceName: string; webhookUrl: string }): Promise<void>;
  getInstanceConnectionState(
    instanceName: string
  ): Promise<"open" | "close" | "connecting">;
  getInstancePhoneNumber(instanceName: string): Promise<string | null>;
  disconnectInstance(instanceName: string): Promise<void>;
  sendTextMessage(params: {
    instanceName: string;
    number: string;
    text: string;
  }): Promise<void>;
  getBase64FromMediaMessage(params: {
    instanceName: string;
    messageKey: Record<string, unknown>;
  }): Promise<{ base64: string; mimeType: string } | null>;
}
