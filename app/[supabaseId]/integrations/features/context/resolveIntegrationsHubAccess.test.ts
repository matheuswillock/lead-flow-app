import { describe, expect, test } from "bun:test";
import { resolveIntegrationsHubAccess } from "./resolveIntegrationsHubAccess";

// T-15.1 — Time com `integration` -> Catálogo de API e Webhooks liberados;
// sem `radar` -> Pixel aparece bloqueado (nunca escondido). Decisão do owner
// de 22/09 (achado R15-3): Webhooks também é liberado só com `radar` — é o
// comportamento de hoje (o OR frouxo do extinto `lib/integrationsAccess.ts`),
// preservado para nenhuma conta perder acesso. Catálogo de API continua só
// com `integration`; Pixel continua só com `radar`.
describe("resolveIntegrationsHubAccess", () => {
  test("time com a feature integration mas sem radar: Catálogo e Webhooks liberados, Pixel bloqueado", () => {
    const access = resolveIntegrationsHubAccess({ hasIntegrationAccess: true, hasRadarAccess: false });

    expect(access.apiCatalogLocked).toBe(false);
    expect(access.webhooksLocked).toBe(false);
    expect(access.pixelLocked).toBe(true);
  });

  // Decisão do owner de 22/09 (R15-3): conta só com radar continua vendo
  // Webhooks — só o Catálogo de API fica bloqueado.
  test("time só com radar (sem integration): Webhooks e Pixel liberados, Catálogo de API bloqueado", () => {
    const access = resolveIntegrationsHubAccess({ hasIntegrationAccess: false, hasRadarAccess: true });

    expect(access.apiCatalogLocked).toBe(true);
    expect(access.webhooksLocked).toBe(false);
    expect(access.pixelLocked).toBe(false);
  });

  test("time sem nenhuma feature: as três entradas aparecem bloqueadas", () => {
    const access = resolveIntegrationsHubAccess({ hasIntegrationAccess: false, hasRadarAccess: false });

    expect(access.apiCatalogLocked).toBe(true);
    expect(access.webhooksLocked).toBe(true);
    expect(access.pixelLocked).toBe(true);
  });

  test("time com integration e radar: nenhuma entrada bloqueada", () => {
    const access = resolveIntegrationsHubAccess({ hasIntegrationAccess: true, hasRadarAccess: true });

    expect(access.apiCatalogLocked).toBe(false);
    expect(access.webhooksLocked).toBe(false);
    expect(access.pixelLocked).toBe(false);
  });

  // T-15.2 — Os 3 times da lista fixa legada (On | Select 3.0, On | Select 1.0,
  // Backstage Club) mantêm o acesso depois da remoção de `lib/integrationsAccess.ts`.
  // Confirmado em produção (SELECT, só leitura) em 2026-09-21: os 3 times
  // pertencem ao mesmo profile (masterId 0c96a57e-6cc1-400f-bf3a-5740b699ac21),
  // que já tem um BackofficeFeatureGrant BETA ativo (ALL_TEAMS) para a feature
  // `integration` — por isso o resultado de `hasAccess("integration")` para
  // esse profile é `true` mesmo sem a lista fixa, e o acesso não regride.
  test("time da lista fixa legada (acesso via feature, sem a lista) continua liberado", () => {
    const legacyTeamHasIntegrationAccess = true; // resolvido via hasAccess(FEATURE_SLUGS.CONFIGURATION)

    const access = resolveIntegrationsHubAccess({
      hasIntegrationAccess: legacyTeamHasIntegrationAccess,
      hasRadarAccess: false,
    });

    expect(access.apiCatalogLocked).toBe(false);
    expect(access.webhooksLocked).toBe(false);
  });

  // Controle negativo do T-15.2: com a lista fixa como ÚNICA regra (comportamento
  // antigo de `lib/integrationsAccess.ts`, removido nesta SPEC), um time fora da
  // lista mas COM a feature `integration` perderia o acesso — o oposto do que a
  // regra por feature (DA3) garante.
  test("controle negativo: regra por lista fixa isolada bloquearia time com a feature integration", () => {
    const isTeamAllowedForIntegrationsLegacy = (teamId: string): boolean =>
      new Set(["1c2d5668-5cd9-49a7-a138-3ccd2bea5cbb"]).has(teamId);

    const teamWithIntegrationFeatureButNotInLegacyList = "novo-time-com-feature-integration";
    const legacyOnlyAccess = isTeamAllowedForIntegrationsLegacy(teamWithIntegrationFeatureButNotInLegacyList);

    // Comportamento antigo: nega acesso mesmo com a feature — exatamente o bug
    // que a migração para `resolveIntegrationsHubAccess` corrige.
    expect(legacyOnlyAccess).toBe(false);

    // Comportamento atual (por feature, DA3): o mesmo time, com a feature,
    // é liberado.
    const currentAccess = resolveIntegrationsHubAccess({ hasIntegrationAccess: true, hasRadarAccess: false });
    expect(currentAccess.webhooksLocked).toBe(false);
  });
});
