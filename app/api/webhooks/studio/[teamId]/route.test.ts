import { describe, expect, it, mock } from "bun:test";

/**
 * SPEC 10, DA4/A-E4 (T-10.13) — a rota sem token no path
 * (`/api/webhooks/studio/{teamId}`) responde 401 para QUALQUER corpo,
 * sempre — o modo "Sem token" saiu (0 webhooks nesse modo medidos em
 * produção). R10-4 (revisão Opus): faltava um teste nomeado para este
 * comportamento, apesar de estar coberto indiretamente pelo handler.
 *
 * A rota importa `studioWebhookErrors` do módulo real do UseCase, que
 * carrega `leadUseCaseFactory` transitivamente (import "server-only" via
 * lib/cache/invalidation) — mock necessário só para o teste rodar fora de
 * um Server Component, igual ao padrão já usado em
 * StudioWebhookIntegrationUseCase.authenticateInboundWebhook.test.ts.
 */
mock.module("@/app/api/useCases/leads/leadUseCaseFactory", () => ({
  leadUseCase: {
    createLead: mock(async () => {
      throw new Error("não usado neste arquivo de teste");
    }),
  },
}));

const { POST } = await import("./route");

describe("POST /api/webhooks/studio/[teamId] — rota sem token está morta (T-10.13)", () => {
  it("sem corpo → 401", async () => {
    const response = await POST();

    expect(response.status).toBe(401);
    const body = (await response.json()) as { isValid: boolean };
    expect(body.isValid).toBe(false);
  });

  it("responde sempre a mesma coisa, independente de a rota receber args (sem estado, sem parsing)", async () => {
    const first = await POST();
    const second = await POST();

    expect(first.status).toBe(401);
    expect(second.status).toBe(401);
  });
});
