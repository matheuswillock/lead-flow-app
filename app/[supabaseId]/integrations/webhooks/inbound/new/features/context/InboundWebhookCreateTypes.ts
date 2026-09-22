import type { IInboundWebhookCreateService } from "../services/IInboundWebhookCreateService";

/**
 * SPEC 10, R10-5 (revisão Opus, decisão do owner) — features/context mínima
 * e real para esta rota: centraliza a derivação de caminhos de navegação
 * (hoje duplicada dentro do componente compartilhado
 * `InboundWebhookCreateContainer`) e injeta o Service page-local, que faz
 * a chamada real de criação em vez do componente compartilhado importar
 * `teamWebhooksService` direto.
 */
export type InboundWebhookCreateContextValue = {
  supabaseId: string;
  listPath: string;
  buildDetailPath: (webhookId: string) => string;
  service: IInboundWebhookCreateService;
};
