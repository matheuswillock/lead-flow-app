/**
 * Regra de acesso do hub de Integrações (DA3 da SPEC 15, com a decisão do
 * owner de 22/09 sobre R15-3): cada entrada depende de feature, nunca de
 * lista fixa de times.
 * - Catálogo de API: feature própria `api-catalog` (FEATURE_SLUGS.API_CATALOG,
 *   filha de `integration` com `inheritParentSettings`, mesma regra de acesso
 *   de antes).
 * - Webhooks: feature própria `webhooks` (FEATURE_SLUGS.WEBHOOKS) OU `radar`
 *   — preserva o acesso de quem já vê Webhooks hoje só com `radar`; nenhuma
 *   conta perde acesso.
 * - Pixel: feature própria `pixel` (FEATURE_SLUGS.PIXEL, filha de `radar`).
 * Entrada sem a feature aparece bloqueada (com o caminho para contratar),
 * nunca escondida.
 */
export interface IntegrationsHubAccess {
  apiCatalogLocked: boolean;
  webhooksLocked: boolean;
  pixelLocked: boolean;
}

export function resolveIntegrationsHubAccess(params: {
  hasApiCatalogAccess: boolean;
  hasWebhooksAccess: boolean;
  hasRadarAccess: boolean;
  hasPixelAccess: boolean;
}): IntegrationsHubAccess {
  const hasWebhooksAccess = params.hasWebhooksAccess || params.hasRadarAccess;

  return {
    apiCatalogLocked: !params.hasApiCatalogAccess,
    webhooksLocked: !hasWebhooksAccess,
    pixelLocked: !params.hasPixelAccess,
  };
}
