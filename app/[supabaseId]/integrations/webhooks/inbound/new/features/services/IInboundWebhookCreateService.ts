import type {
  CreateInboundWebhookPayload,
  TeamWebhookSummary,
} from "../../../../features/services/ITeamWebhooksService";

/**
 * SPEC 10, R10-5 (revisão Opus, decisão do owner) — a única chamada real
 * desta página (criar um webhook de entrada). `InboundWebhookCreateService`
 * delega para `teamWebhooksService` — chamada real, não fachada vazia.
 */
export interface IInboundWebhookCreateService {
  create(supabaseId: string, teamId: string, payload: CreateInboundWebhookPayload): Promise<TeamWebhookSummary>;
}
