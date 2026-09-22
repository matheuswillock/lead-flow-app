import { Output } from "@/lib/output";

export type StudioWebhookTokenMode = "manual" | "auto";
export type StudioWebhookTokenExpiryModeValue = "hours_24" | "months_6" | "indeterminate";

export type StudioWebhookLeadPayload = {
  name: string;
  email?: string;
  phone?: string;
  cnpj?: string;
  ages?: string;
  current_health_plan?: string;
  current_value?: number;
  reference_hospital?: string;
  current_treatment?: string;
  source?: string;
  metadata?: Record<string, unknown>;
};

export type UpsertStudioWebhookConfigUseCaseInput = {
  teamId: string;
  updatedByProfileId: string;
  tokenMode: StudioWebhookTokenMode;
  manualToken?: string;
  expiryMode: StudioWebhookTokenExpiryModeValue;
  appUrl: string;
  /**
   * SPEC 10, DA1/A-E1: com configuração existente (TeamWebhook inbound OU
   * legado), a rotação do token exige confirmação explícita. Sem isso, o
   * PUT retorna 409 `rotation_requires_confirmation` e não toca o token
   * atual. A UI pede essa confirmação via AlertDialog (B-E1).
   */
  confirmRotation?: boolean;
};

export type GetStudioWebhookConfigUseCaseInput = {
  teamId: string;
  appUrl: string;
};

export type ProcessStudioWebhookLeadInput = {
  teamId: string;
  token?: string;
  payload: StudioWebhookLeadPayload;
};

export type AuthenticateInboundWebhookInput = {
  teamId: string;
  token?: string;
};

export type AuthenticateInboundWebhookResult = {
  authenticated: boolean;
  webhookId: string | null;
  supabaseId: string | null;
  source: "team_webhook" | "legacy" | null;
};

export type StudioWebhookRequestLogResultType = "success" | "error";

export type RegisterStudioWebhookRequestLogUseCaseInput = {
  teamId: string;
  method: string;
  endpoint: string;
  statusCode: number;
  resultType: StudioWebhookRequestLogResultType;
  requestPayload?: unknown;
  responsePayload?: unknown;
  errorMessage?: string | null;
  webhookId?: string | null;
  token?: string | null;
};

export type GetStudioWebhookLogsUseCaseInput = {
  teamId: string;
  /** SPEC 10, W32: paginação real — `page`/`pageSize` substituem o `limit` fixo em 15. */
  page?: number;
  pageSize?: number;
};

export interface IStudioWebhookIntegrationUseCase {
  verifyTeamExists(teamId: string): Promise<boolean>;
  getConfiguration(input: GetStudioWebhookConfigUseCaseInput): Promise<Output>;
  upsertConfiguration(input: UpsertStudioWebhookConfigUseCaseInput): Promise<Output>;
  /**
   * SPEC 10, DA2 — resolve autenticação (time + webhook + token) SEM ler
   * ou processar o corpo da requisição e SEM criar lead. Usado pelo handler
   * antes de qualquer trabalho (leitura do corpo, scan, validação de
   * schema), para que uma requisição não autenticada nunca chegue lá.
   * `Output.result` é sempre um `AuthenticateInboundWebhookResult`.
   */
  authenticateInboundWebhook(input: AuthenticateInboundWebhookInput): Promise<Output>;
  processWebhookLead(input: ProcessStudioWebhookLeadInput): Promise<Output>;
  getLatestWebhookLogs(input: GetStudioWebhookLogsUseCaseInput): Promise<Output>;
  registerWebhookRequestLog(input: RegisterStudioWebhookRequestLogUseCaseInput): Promise<void>;
  /**
   * SPEC 10, DA3 — grava só em `TeamWebhookEventLog` (não no legado), para
   * o 429 das camadas "webhook" e "time" do limitador, que não tem corpo
   * de requisição para logar.
   */
  registerWebhookRateLimitRejection(input: {
    teamId: string;
    webhookId: string;
    endpoint: string;
  }): Promise<void>;
}
