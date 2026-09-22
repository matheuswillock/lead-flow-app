import type {
  CreateOutboundWebhookPayload,
  TeamWebhookSummary,
} from "../../../../features/services/ITeamWebhooksService";

/**
 * SPEC 10, R10-5 (revisão Opus, decisão do owner) — a única chamada real
 * desta página (criar um webhook de saída). `OutboundWebhookCreateService`
 * delega para `teamWebhooksService` — chamada real, não fachada vazia.
 */
export interface IOutboundWebhookCreateService {
  create(supabaseId: string, teamId: string, payload: CreateOutboundWebhookPayload): Promise<TeamWebhookSummary>;
}
