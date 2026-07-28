import type {
  Prisma,
  TeamWebhookDirection,
  TeamWebhookEventKey,
  TeamWebhookLogResult,
} from "@prisma/client";

export type CreateTeamWebhookEventLogInput = {
  teamId: string;
  webhookId: string;
  direction: TeamWebhookDirection;
  result: TeamWebhookLogResult;
  eventKey?: TeamWebhookEventKey | null;
  method?: string | null;
  endpoint?: string | null;
  statusCode?: number | null;
  requestPayload?: unknown;
  responsePayload?: unknown;
  errorMessage?: string | null;
};

export type ListTeamWebhookEventLogsParams = {
  webhookId: string;
  teamId: string;
  result?: TeamWebhookLogResult;
  page: number;
  pageSize: number;
};

export type TeamWebhookEventLogRow = {
  id: string;
  teamId: string;
  webhookId: string;
  direction: TeamWebhookDirection;
  result: TeamWebhookLogResult;
  eventKey: TeamWebhookEventKey | null;
  method: string | null;
  endpoint: string | null;
  statusCode: number | null;
  requestPayload: Prisma.JsonValue | null;
  responsePayload: Prisma.JsonValue | null;
  errorMessage: string | null;
  createdAt: Date;
};

export interface ITeamWebhookEventLogRepository {
  create(input: CreateTeamWebhookEventLogInput): Promise<void>;
  list(params: ListTeamWebhookEventLogsParams): Promise<{
    items: TeamWebhookEventLogRow[];
    total: number;
  }>;
}
