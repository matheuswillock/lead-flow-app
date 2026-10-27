/**
 * Regra de acesso do hub de Integrações (DA3 da SPEC 15, com a decisão do
 * owner de 22/09 sobre R15-3): cada entrada depende de feature, nunca de
 * lista fixa de times.
 * - Catálogo de API: feature `integration` (FEATURE_SLUGS.CONFIGURATION).
 * - Webhooks: `integration` OU `radar` — preserva o acesso de quem já vê
 *   Webhooks hoje só com `radar` (comportamento atual do OR frouxo em
 *   `lib/integrationsAccess.ts`, removido); nenhuma conta perde acesso.
 * - Pixel: feature `radar` (FEATURE_SLUGS.RADAR).
 * Entrada sem a feature aparece bloqueada (com o caminho para contratar),
 * nunca escondida.
 */
export interface IntegrationsHubAccess {
  apiCatalogLocked: boolean;
  webhooksLocked: boolean;
  pixelLocked: boolean;
}

export function resolveIntegrationsHubAccess(params: {
  hasIntegrationAccess: boolean;
  hasRadarAccess: boolean;
}): IntegrationsHubAccess {
  const hasWebhooksAccess = params.hasIntegrationAccess || params.hasRadarAccess;

  return {
    apiCatalogLocked: !params.hasIntegrationAccess,
    webhooksLocked: !hasWebhooksAccess,
    pixelLocked: !params.hasRadarAccess,
  };
}
