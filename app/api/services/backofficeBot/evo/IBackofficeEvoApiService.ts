export interface BackofficeEvoQrCode {
  text: string;
  base64: string;
}

export interface BackofficeEvoConnectResult {
  instanceName: string;
  status: "open" | "close" | "connecting";
  qrCode: BackofficeEvoQrCode | null;
}

export interface IBackofficeEvoApiService {
  connectInstance(params: {
    instanceName: string;
    webhookUrl: string;
  }): Promise<BackofficeEvoConnectResult>;
}
