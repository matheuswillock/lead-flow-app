export type StudioWebhookConfigData = {
  configured: boolean;
  // SPEC 10, DA4/A-E4: "none" saiu da criação/edição, mas a LEITURA ainda
  // pode encontrar configuração histórica nesse modo (0 medidos em
  // produção em 21/09) — o tipo de leitura continua aceitando o valor para
  // não quebrar a exibição.
  tokenMode: "manual" | "auto" | "none";
  tokenPreview: string | null;
  expiryMode: "hours_24" | "months_6" | "indeterminate";
  expiresAt: string | null;
  isExpired: boolean;
  lastUsedAt: string | null;
  webhookUrl: string;
  webhookUrlTemplate: string;
};

export type IntegrationsBootstrapResponse = StudioWebhookConfigData & {
  leadFormUrl: string;
};

export type SaveStudioWebhookConfigPayload = {
  teamId: string;
  tokenMode: "manual" | "auto";
  manualToken?: string;
  expiryMode: "hours_24" | "months_6" | "indeterminate";
  /**
   * SPEC 10, DA1/A-E1: obrigatório com `true` quando já existe configuração
   * — sem isso a API responde 409 `rotation_requires_confirmation` e não
   * toca o token atual.
   */
  confirmRotation?: boolean;
};

/**
 * SPEC 10, DA1/A-E1 (T-10.20) — a API recusa rotacionar um token existente
 * sem confirmação explícita. O `IntegrationsService` lança este erro
 * dedicado (em vez de um `Error` genérico) para a tela distinguir "precisa
 * confirmar" de qualquer outra falha e abrir o `AlertDialog` certo.
 */
export class StudioWebhookRotationRequiresConfirmationError extends Error {
  constructor() {
    super("rotation_requires_confirmation");
    this.name = "StudioWebhookRotationRequiresConfirmationError";
  }
}

export type SaveStudioWebhookConfigResponse = StudioWebhookConfigData & {
  token: string;
  webhookUrl: string;
};

export type StudioWebhookLogItem = {
  id: string;
  teamId: string;
  method: string;
  endpoint: string;
  statusCode: number;
  resultType: "success" | "error";
  requestPayload: unknown;
  responsePayload: unknown;
  errorMessage: string | null;
  createdAt: string;
};

export type GetStudioWebhookLogsResponse = {
  logs: StudioWebhookLogItem[];
};

export type RadarPixelConfigData = {
  configured: boolean;
  publicToken: string | null;
  allowedOrigins: string[];
  lastUsedAt: string | null;
  pixelSnippet: string | null;
};

export type SaveRadarPixelConfigPayload = {
  allowedOrigins: string[];
};

export type RadarPixelHitLogItem = {
  id: string;
  teamId: string;
  eventType: string;
  visitorSession: string;
  origin: string | null;
  userAgent: string | null;
  metadata: unknown;
  createdAt: string;
};

export type GetRadarPixelHitLogsResponse = {
  logs: RadarPixelHitLogItem[];
};

export interface IIntegrationsService {
  resolveAppUrl(): string;
  copyToClipboard(value: string): Promise<boolean>;
  getStudioWebhookConfig(supabaseId: string, teamId: string): Promise<IntegrationsBootstrapResponse>;
  getStudioWebhookLogs(supabaseId: string, teamId: string): Promise<GetStudioWebhookLogsResponse>;
  saveStudioWebhookConfig(
    supabaseId: string,
    payload: SaveStudioWebhookConfigPayload
  ): Promise<SaveStudioWebhookConfigResponse>;
  getRadarPixelConfig(supabaseId: string, teamId: string): Promise<RadarPixelConfigData>;
  saveRadarPixelConfig(
    supabaseId: string,
    teamId: string,
    payload: SaveRadarPixelConfigPayload
  ): Promise<RadarPixelConfigData>;
  deleteRadarPixelConfig(supabaseId: string, teamId: string): Promise<void>;
  getRadarPixelHitLogs(supabaseId: string, teamId: string): Promise<GetRadarPixelHitLogsResponse>;
}
