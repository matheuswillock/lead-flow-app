import type { IOutboundWebhookDetailService } from "../services/IOutboundWebhookDetailService";

/**
 * SPEC 10, R10-5 (revisão Opus, decisão do owner) — features/context mínima
 * e real para esta rota: centraliza o caminho de volta à lista (hoje
 * derivado dentro do componente compartilhado `WebhookDetailContainer` a
 * partir de `supabaseId`+`direction`) e injeta o Service page-local, que
 * faz as chamadas reais em vez do componente compartilhado importar
 * `teamWebhooksService` direto.
 */
export type OutboundWebhookDetailContextValue = {
  supabaseId: string;
  webhookId: string;
  listPath: string;
  service: IOutboundWebhookDetailService;
};
