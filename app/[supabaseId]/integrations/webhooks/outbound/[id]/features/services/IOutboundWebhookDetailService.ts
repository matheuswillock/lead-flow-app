import type {
  TeamWebhookLogItem,
  TeamWebhookLogResult,
  TeamWebhookSummary,
  UpdateTeamWebhookPayload,
} from "../../../../features/services/ITeamWebhooksService";

/**
 * SPEC 10, R10-5 (revisão Opus, decisão do owner) — subconjunto de
 * `ITeamWebhooksService` que esta página realmente chama (get, editar,
 * mudar status, testar disparo, listar logs). `OutboundWebhookDetailService`
 * delega para `teamWebhooksService` (chamada real, não fachada vazia).
 */
export interface IOutboundWebhookDetailService {
  getById(supabaseId: string, teamId: string, id: string): Promise<TeamWebhookSummary>;
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
