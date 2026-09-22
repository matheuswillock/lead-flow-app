import type { IOutboundWebhookCreateService } from "../services/IOutboundWebhookCreateService";

/**
 * SPEC 10, R10-5 (revisão Opus, decisão do owner) — features/context mínima
 * e real para esta rota: centraliza a derivação de caminhos de navegação
 * (hoje duplicada dentro do componente compartilhado
 * `OutboundWebhookCreateContainer`) e injeta o Service page-local, que faz
 * a chamada real de criação em vez do componente compartilhado importar
 * `teamWebhooksService` direto.
 */
export type OutboundWebhookCreateContextValue = {
  supabaseId: string;
  listPath: string;
  buildDetailPath: (webhookId: string) => string;
  service: IOutboundWebhookCreateService;
};
