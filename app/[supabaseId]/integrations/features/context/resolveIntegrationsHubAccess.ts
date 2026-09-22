/**
 * Regra de acesso do hub de Integrações (DA3 da SPEC 15): cada entrada
 * depende só da feature correspondente, nunca de lista fixa de times.
 * - Catálogo de API e Webhooks: feature `integration` (FEATURE_SLUGS.CONFIGURATION).
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
  return {
    apiCatalogLocked: !params.hasIntegrationAccess,
    webhooksLocked: !params.hasIntegrationAccess,
    pixelLocked: !params.hasRadarAccess,
  };
}
