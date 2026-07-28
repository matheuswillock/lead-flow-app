export type TeamWebhookDirection = "inbound" | "outbound";
export type TeamWebhookStatus = "active" | "paused" | "disabled";
export type TeamWebhookDestinationPreset = "generic" | "slack" | "teams" | "zapier";
export type TeamWebhookEventKey =
  | "lead_created"
  | "lead_status_changed"
  | "lead_assigned"
  | "appointment_created"
  | "appointment_reminder"
  | "activity_created";
export type TeamWebhookLogResult = "success" | "failure" | "rejected";

export type TeamWebhookSummary = {
  id: string;
  direction: TeamWebhookDirection;
  status: TeamWebhookStatus;
  name: string;
  targetUrl: string | null;
  destinationPreset: TeamWebhookDestinationPreset | null;
  selectedEvents: TeamWebhookEventKey[];
  failureStreak: number;
  failureThreshold: number;
  lastUsedAt: string | null;
  lastSuccessAt: string | null;
  lastFailureAt: string | null;
  pausedAt: string | null;
  pauseReason: string | null;
  tokenPreview: string | null;
  expiryMode: "hours_24" | "months_6" | "indeterminate" | null;
  expiresAt: string | null;
  webhookUrl: string | null;
  createdAt: string;
  updatedAt: string;
  token?: string;
};

export type TeamWebhookLogItem = {
  id: string;
  teamId: string;
  webhookId: string;
  direction: TeamWebhookDirection;
  result: TeamWebhookLogResult;
  eventKey: TeamWebhookEventKey | null;
  method: string | null;
  endpoint: string | null;
  statusCode: number | null;
  requestPayload: unknown;
  responsePayload: unknown;
  errorMessage: string | null;
  createdAt: string;
};

export type CreateInboundWebhookPayload = {
  direction: "inbound";
  name: string;
  tokenMode: "manual" | "auto" | "none";
  manualToken?: string;
  expiryMode: "hours_24" | "months_6" | "indeterminate";
};

export type CreateOutboundWebhookPayload = {
  direction: "outbound";
  name: string;
  targetUrl: string;
  destinationPreset: TeamWebhookDestinationPreset;
  selectedEvents: TeamWebhookEventKey[];
  failureThreshold?: number;
};

export type UpdateTeamWebhookPayload = {
  name?: string;
  targetUrl?: string;
  destinationPreset?: TeamWebhookDestinationPreset;
  selectedEvents?: TeamWebhookEventKey[];
  failureThreshold?: number;
  tokenMode?: "manual" | "auto" | "none";
  manualToken?: string;
  expiryMode?: "hours_24" | "months_6" | "indeterminate";
};

export interface ITeamWebhooksService {
  list(
    supabaseId: string,
    teamId: string,
    params: {
      direction: TeamWebhookDirection;
      page?: number;
      pageSize?: number;
      status?: TeamWebhookStatus;
      search?: string;
    }
  ): Promise<{ items: TeamWebhookSummary[]; total: number; page: number; pageSize: number }>;
  getById(supabaseId: string, teamId: string, id: string): Promise<TeamWebhookSummary>;
  create(
    supabaseId: string,
    teamId: string,
    payload: CreateInboundWebhookPayload | CreateOutboundWebhookPayload
  ): Promise<TeamWebhookSummary>;
  update(
    supabaseId: string,
    teamId: string,
    id: string,
    payload: UpdateTeamWebhookPayload
  ): Promise<TeamWebhookSummary>;
  changeStatus(
    supabaseId: string,
    teamId: string,
    id: string,
    body: { status: "active" | "disabled" } | { action: "reactivate" }
  ): Promise<TeamWebhookSummary>;
  listLogs(
    supabaseId: string,
    teamId: string,
    id: string,
    params: { page?: number; pageSize?: number; result?: TeamWebhookLogResult }
  ): Promise<{ items: TeamWebhookLogItem[]; total: number; page: number; pageSize: number }>;
  testDelivery(
    supabaseId: string,
    teamId: string,
    id: string
  ): Promise<{ ok: boolean; statusCode: number | null; errorMessage: string | null }>;
}

export const WEBHOOK_EVENT_OPTIONS: Array<{ value: TeamWebhookEventKey; label: string }> = [
  { value: "lead_created", label: "Lead criado" },
  { value: "lead_status_changed", label: "Status do lead alterado" },
  { value: "lead_assigned", label: "Lead atribuído" },
  { value: "appointment_created", label: "Agendamento criado" },
  { value: "appointment_reminder", label: "Lembrete de agendamento" },
  { value: "activity_created", label: "Atividade/nota criada" },
];
