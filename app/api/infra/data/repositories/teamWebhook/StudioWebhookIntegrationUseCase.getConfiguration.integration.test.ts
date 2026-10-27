import { afterAll, describe, expect, it, mock } from "bun:test";
import { randomUUID } from "crypto";

// lib/cache/invalidation.ts importa "server-only" — StudioWebhookIntegrationUseCase
// carrega leadUseCaseFactory transitivamente (mesmo caminho documentado em
// processAsaasWebhookEvent.account-collision.integration.test.ts). Mockado
// como no-op para não derrubar o import fora de contexto Next. Precisa
// listar cada export nomeado: bun valida bindings ESM estáticos contra as
// chaves do módulo mockado, um Proxy sem `ownKeys` não satisfaz isso.
mock.module("@/lib/cache/invalidation", () => ({
  invalidateLeadCache: () => {},
  invalidateLeadFullCache: () => {},
  invalidateTeamCalendarCache: () => {},
  invalidatePortfolioCache: () => {},
  invalidateAccountAccessStatusCache: () => {},
  invalidateFeatureAccessCache: () => {},
  invalidateTeamMembersCache: () => {},
  invalidatePublicFormBootstrapCache: () => {},
  invalidateTeamFormDomainCache: () => {},
  invalidateHealthPlansCache: () => {},
  invalidateBackofficeFeaturesCache: () => {},
  invalidateTeamStatusRulesCache: () => {},
  invalidateLeadStatusTransitionFieldRulesCache: () => {},
  invalidateLeadStatusTransitionGatesCache: () => {},
  invalidateTeamLeadsCache: () => {},
  invalidateLeadActivitiesCache: () => {},
  invalidateTeamTasksCache: () => {},
  invalidateTeamFilterPresetsCache: () => {},
  invalidateNotificationsCache: () => {},
  invalidateRadarSegmentsCache: () => {},
}));

// ShortLinkService precisa de NEXT_PUBLIC_APP_URL configurada — irrelevante
// para o que este teste prova (leitura de TeamWebhook). Mockado como no-op.
mock.module("@/app/api/services/shortLink/ShortLinkService", () => ({
  shortLinkService: {
    getOrCreate: async ({ targetUrl }: { targetUrl: string }) => `https://short.test/${encodeURIComponent(targetUrl)}`,
  },
}));

/**
 * SPEC 10, A-E1 — T-10.4: criar pela tela nova (TeamWebhookService.create,
 * que grava só em TeamWebhook) e confirmar que GET /studio-webhook
 * (getConfiguration) já responde `configured: true`, sem precisar de
 * nenhuma linha em TeamStudioWebhookConfig. Prova, contra Postgres real, que
 * DA1 (fonte de verdade única) fecha o W1 medido na auditoria (time
 * MultiSkill: TeamWebhook ativo, tela legada dizendo "Token não
 * configurado").
 *
 * Arquivo vive em `app/api/infra/data/repositories/teamWebhook/` (não em
 * `app/api/useCases/integrations/`, onde o use case testado realmente mora)
 * pelo mesmo motivo de
 * `processAsaasWebhookEvent.account-collision.integration.test.ts`: o
 * `governance:check` proíbe acesso Prisma direto fora da camada Repository,
 * e este teste PRECISA semear dados reais (profile/team/TeamWebhook) para
 * provar o comportamento contra Postgres — não é o UseCase de produção quem
 * acessa Prisma aqui, é a arrumação do teste.
 *
 * Rodar:
 *   WEBHOOKS_INTEGRATION_TEST=1 \
 *   DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:55322/postgres \
 *   bun test app/api/infra/data/repositories/teamWebhook/StudioWebhookIntegrationUseCase.getConfiguration.integration.test.ts
 */
const RUN_INTEGRATION =
  process.env.WEBHOOKS_INTEGRATION_TEST === "1" && Boolean(process.env.DATABASE_URL);

function assertLocalDatabase(): void {
  const url = process.env.DATABASE_URL ?? "";
  const isLocal = /@(127\.0\.0\.1|localhost|host\.docker\.internal)[:/]/.test(url);
  if (!isLocal) {
    throw new Error(
      "[integration] abortado: DATABASE_URL não é local. Este teste escreve no banco — " +
        "rode com `bun run test:integration:webhooks:local` ou passe a URL de 127.0.0.1:55322."
    );
  }
}

let prisma: typeof import("@/app/api/infra/data/prisma").prisma;
let studioWebhookIntegrationUseCase: typeof import(
  "@/app/api/useCases/integrations/StudioWebhookIntegrationUseCase"
).studioWebhookIntegrationUseCase;
let teamWebhookRepository: typeof import("./TeamWebhookRepository").teamWebhookRepository;

if (RUN_INTEGRATION) {
  assertLocalDatabase();
  ({ prisma } = await import("@/app/api/infra/data/prisma"));
  ({ studioWebhookIntegrationUseCase } = await import(
    "@/app/api/useCases/integrations/StudioWebhookIntegrationUseCase"
  ));
  ({ teamWebhookRepository } = await import("./TeamWebhookRepository"));
}

const describeIntegration = RUN_INTEGRATION ? describe : describe.skip;

const scope = { profileId: "", teamId: "" };

async function seed(): Promise<void> {
  const profile = await prisma.profile.create({
    data: {
      email: `spec10-a-e1-${randomUUID()}@example.test`,
      fullName: "Spec 10 A-E1",
      role: "manager",
      supabaseId: randomUUID(),
    },
    select: { id: true },
  });
  scope.profileId = profile.id;

  const team = await prisma.team.create({
    data: { name: "Spec 10 A-E1 Team", masterId: profile.id },
    select: { id: true },
  });
  scope.teamId = team.id;
}

async function cleanup(): Promise<void> {
  if (!RUN_INTEGRATION) return;
  await prisma.teamWebhook.deleteMany({ where: { teamId: scope.teamId } });
  await prisma.team.deleteMany({ where: { id: scope.teamId } });
  await prisma.profile.deleteMany({ where: { id: scope.profileId } });
}

describeIntegration("getConfiguration lê TeamWebhook criado pela tela nova (T-10.4)", () => {
  afterAll(cleanup);

  it("criar pela tela nova (só TeamWebhook) → getConfiguration já responde configured:true", async () => {
    await seed();

    await teamWebhookRepository.createWithCtx(
      { profileId: scope.profileId, teamId: scope.teamId },
      {
        direction: "inbound",
        name: "Webhook Genérico de Leads",
        tokenHash: "integration-hash",
        tokenCipher: null,
        tokenPreview: "integr...oken",
        expiryMode: "indeterminate",
        expiresAt: null,
        status: "active",
      }
    );

    const output = await studioWebhookIntegrationUseCase.getConfiguration({
      teamId: scope.teamId,
      appUrl: "https://app.test",
    });

    expect(output.isValid).toBe(true);
    expect((output.result as { configured: boolean }).configured).toBe(true);
    expect((output.result as { tokenPreview: string }).tokenPreview).toBe("integr...oken");

    const legacyRow = await prisma.teamStudioWebhookConfig.findUnique({
      where: { teamId: scope.teamId },
    });
    expect(legacyRow).toBeNull();
  });
});
