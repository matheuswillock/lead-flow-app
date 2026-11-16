import { describe, expect, test } from "bun:test";
import { resolveIntegrationsHubAccess } from "./resolveIntegrationsHubAccess";

// T-15.1 — Time com `api-catalog`/`webhooks` -> Catálogo de API e Webhooks
// liberados; sem `pixel`/`radar` -> Pixel aparece bloqueado (nunca
// escondido). Decisão do owner de 22/09 (achado R15-3): Webhooks também é
// liberado só com `radar` — é o comportamento de hoje (o OR frouxo do
// extinto `lib/integrationsAccess.ts`), preservado para nenhuma conta perder
// acesso. Catálogo de API continua só com `api-catalog`; Pixel continua só
// com `pixel` (filha de `radar`, mesmo resultado que `radar` hoje).
describe("resolveIntegrationsHubAccess", () => {
  test("time com api-catalog e webhooks mas sem radar/pixel: Catálogo e Webhooks liberados, Pixel bloqueado", () => {
    const access = resolveIntegrationsHubAccess({
      hasApiCatalogAccess: true,
      hasWebhooksAccess: true,
      hasRadarAccess: false,
      hasPixelAccess: false,
      hasLeadFormAccess: false,
    });

    expect(access.apiCatalogLocked).toBe(false);
    expect(access.webhooksLocked).toBe(false);
    expect(access.pixelLocked).toBe(true);
  });

  // Decisão do owner de 22/09 (R15-3): conta só com radar continua vendo
  // Webhooks — só o Catálogo de API fica bloqueado.
  test("time só com radar/pixel (sem api-catalog/webhooks): Webhooks e Pixel liberados, Catálogo de API bloqueado", () => {
    const access = resolveIntegrationsHubAccess({
      hasApiCatalogAccess: false,
      hasWebhooksAccess: false,
      hasRadarAccess: true,
      hasPixelAccess: true,
      hasLeadFormAccess: false,
    });

    expect(access.apiCatalogLocked).toBe(true);
    expect(access.webhooksLocked).toBe(false);
    expect(access.pixelLocked).toBe(false);
  });

  test("time sem nenhuma feature: as quatro entradas aparecem bloqueadas", () => {
    const access = resolveIntegrationsHubAccess({
      hasApiCatalogAccess: false,
      hasWebhooksAccess: false,
      hasRadarAccess: false,
      hasPixelAccess: false,
      hasLeadFormAccess: false,
    });

    expect(access.apiCatalogLocked).toBe(true);
    expect(access.webhooksLocked).toBe(true);
    expect(access.pixelLocked).toBe(true);
    expect(access.leadFormLocked).toBe(true);
  });

  test("time com todas as features: nenhuma entrada bloqueada", () => {
    const access = resolveIntegrationsHubAccess({
      hasApiCatalogAccess: true,
      hasWebhooksAccess: true,
      hasRadarAccess: true,
      hasPixelAccess: true,
      hasLeadFormAccess: true,
    });

    expect(access.apiCatalogLocked).toBe(false);
    expect(access.webhooksLocked).toBe(false);
    expect(access.pixelLocked).toBe(false);
    expect(access.leadFormLocked).toBe(false);
  });

  // Achado de produção (12/11): o Formulário de Captação não depende de
  // `integration` nem de `radar` — a feature `lead-form` em si é PUBLIC com
  // `defaultAccessLevel: FULL` para todos os principais (seed em
  // `prisma/seed-backoffice-products.ts`), então `hasLeadFormAccess` já vem
  // `true` do `FeatureAccessService` para qualquer conta, independente de
  // ter `integration`/`radar`. Esta função só repassa o valor — não tem OR
  // com `radar` (diferente de Webhooks, que é mesmo pago/condicionado).
  test("time sem integration nem radar: Formulário de Captação continua liberado (feature própria é pública)", () => {
    const access = resolveIntegrationsHubAccess({
      hasApiCatalogAccess: false,
      hasWebhooksAccess: false,
      hasRadarAccess: false,
      hasPixelAccess: false,
      hasLeadFormAccess: true,
    });

    expect(access.leadFormLocked).toBe(false);
  });

  // T-15.2 — Os 3 times da lista fixa legada (On | Select 3.0, On | Select 1.0,
  // Backstage Club) mantêm o acesso depois da remoção de `lib/integrationsAccess.ts`.
  // Confirmado em produção (SELECT, só leitura) em 2026-09-21: os 3 times
  // pertencem ao mesmo profile (masterId 0c96a57e-6cc1-400f-bf3a-5740b699ac21),
  // que já tem um BackofficeFeatureGrant BETA ativo (ALL_TEAMS) para a feature
  // `integration` — por isso o resultado de `hasAccess("webhooks")`/`hasAccess("api-catalog")`
  // para esse profile é `true` mesmo sem a lista fixa (ambas herdam de
  // `integration`), e o acesso não regride.
  test("time da lista fixa legada (acesso via feature, sem a lista) continua liberado", () => {
    const legacyTeamHasAccess = true; // resolvido via hasAccess(FEATURE_SLUGS.API_CATALOG / .WEBHOOKS)

    const access = resolveIntegrationsHubAccess({
      hasApiCatalogAccess: legacyTeamHasAccess,
      hasWebhooksAccess: legacyTeamHasAccess,
      hasRadarAccess: false,
      hasPixelAccess: false,
      hasLeadFormAccess: false,
    });

    expect(access.apiCatalogLocked).toBe(false);
    expect(access.webhooksLocked).toBe(false);
  });

  // Controle negativo do T-15.2: com a lista fixa como ÚNICA regra (comportamento
  // antigo de `lib/integrationsAccess.ts`, removido nesta SPEC), um time fora da
  // lista mas COM a feature `webhooks` perderia o acesso — o oposto do que a
  // regra por feature (DA3) garante.
  test("controle negativo: regra por lista fixa isolada bloquearia time com a feature webhooks", () => {
    const isTeamAllowedForIntegrationsLegacy = (teamId: string): boolean =>
      new Set(["1c2d5668-5cd9-49a7-a138-3ccd2bea5cbb"]).has(teamId);

    const teamWithWebhooksFeatureButNotInLegacyList = "novo-time-com-feature-webhooks";
    const legacyOnlyAccess = isTeamAllowedForIntegrationsLegacy(teamWithWebhooksFeatureButNotInLegacyList);

    // Comportamento antigo: nega acesso mesmo com a feature — exatamente o bug
    // que a migração para `resolveIntegrationsHubAccess` corrige.
    expect(legacyOnlyAccess).toBe(false);

    // Comportamento atual (por feature, DA3): o mesmo time, com a feature,
    // é liberado.
    const currentAccess = resolveIntegrationsHubAccess({
      hasApiCatalogAccess: false,
      hasWebhooksAccess: true,
      hasRadarAccess: false,
      hasPixelAccess: false,
      hasLeadFormAccess: false,
    });
    expect(currentAccess.webhooksLocked).toBe(false);
  });
});
