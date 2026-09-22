import { afterAll, beforeEach, describe, expect, it } from "bun:test";
import type { TeamWebhookOutboxClaimRow } from "@/app/api/infra/data/repositories/teamWebhook/ITeamWebhookOutboxRepository";
import { encryptWebhookSigningSecret } from "@/lib/webhooks/webhookSigningSecurity";
import { ProcessWebhookOutboxUseCase } from "./ProcessWebhookOutboxUseCase";

/**
 * Cifra válida (AES-256-GCM real) usada como fixture padrão nos testes que
 * exercitam a entrega HTTP em si (concorrência, contador por evento) — desde
 * o achado de code review do Codex (PR #1220), um webhook sem segredo
 * (cifra ausente OU ilegível) nunca chega a chamar `deliveryService.deliver()`.
 * Sem uma cifra válida aqui, esses testes cairiam no bloqueio de segurança em
 * vez de exercitar o que realmente testam.
 */
const VALID_SIGNING_SECRET_CIPHER = encryptWebhookSigningSecret(
  "test-secret-for-outbox-processing-fixture"
);
if (!VALID_SIGNING_SECRET_CIPHER) {
  throw new Error("Não foi possível gerar a cifra fixture para os testes do outbox");
}

function makeClaimRow(id: string): TeamWebhookOutboxClaimRow {
  return {
    id,
    teamId: "team-1",
    webhookId: "webhook-1",
    eventKey: "lead_created",
    payload: {
      eventKey: "lead_created",
      occurredAt: "2026-08-12T12:00:00.000Z",
      data: {},
    },
    status: "processing",
    attemptCount: 0,
    nextAttemptAt: new Date("2026-08-12T12:00:00.000Z"),
  };
}

describe("ProcessWebhookOutboxUseCase", () => {
  const previousConcurrency = process.env.TEAM_WEBHOOK_OUTBOX_CONCURRENCY;

  beforeEach(() => {
    process.env.TEAM_WEBHOOK_OUTBOX_CONCURRENCY = "2";
  });

  afterAll(() => {
    if (previousConcurrency === undefined) {
      delete process.env.TEAM_WEBHOOK_OUTBOX_CONCURRENCY;
    } else {
      process.env.TEAM_WEBHOOK_OUTBOX_CONCURRENCY = previousConcurrency;
    }
  });

  it("respeita concorrência máxima ao processar múltiplas linhas", async () => {
    let inFlight = 0;
    let maxInFlight = 0;
    let deliverCalls = 0;

    const outboxRepository = {
      claimDue: async () => Array.from({ length: 5 }, (_, i) => makeClaimRow(`outbox-${i}`)),
      markDelivered: async () => {},
      markFailed: async () => {},
      requeueIfProcessing: async () => {},
      cancelPendingForWebhook: async () => {},
    };

    const webhookRepository = {
      findForDelivery: async () => ({
        id: "webhook-1",
        teamId: "team-1",
        name: "Hook",
        status: "active",
        targetUrl: "https://example.com/hook",
        destinationPreset: "generic",
        failureStreak: 0,
        failureThreshold: 5,
        signingSecretCipher: VALID_SIGNING_SECRET_CIPHER,
        updatedByProfileId: "profile-1",
      }),
      resetFailureStreak: async () => {},
      incrementFailureStreak: async () => ({
        failureStreak: 1,
        failureThreshold: 5,
      }),
      markPausedByFailures: async () => {},
      findTeamMasterId: async () => null,
      createAutoPausedNotification: async () => {},
    };

    const eventLogRepository = {
      create: async () => {},
    };

    const deliveryService = {
      deliver: async () => {
        deliverCalls += 1;
        inFlight += 1;
        maxInFlight = Math.max(maxInFlight, inFlight);
        await new Promise((r) => setTimeout(r, 15));
        inFlight -= 1;
        return {
          ok: true,
          statusCode: 200,
          responseBody: { ok: true },
          errorMessage: null,
        };
      },
    };

    const useCase = new ProcessWebhookOutboxUseCase(
      outboxRepository as never,
      webhookRepository as never,
      eventLogRepository as never,
      deliveryService as never
    );
    const output = await useCase.execute();

    expect(output.isValid).toBe(true);
    expect(deliverCalls).toBe(5);
    expect(maxInFlight).toBeLessThanOrEqual(2);
    expect(maxInFlight).toBeGreaterThan(1);
  });
});

describe("ProcessWebhookOutboxUseCase — contador de falha por evento (DA3/W13)", () => {
  function makeRepos(overrides: {
    incrementFailureStreak?: () => Promise<{ failureStreak: number; failureThreshold: number }>;
    signingSecretCipher?: string | null;
  } = {}) {
    const markFailedCalls: Array<{ id: string; attemptCount: number; nextAttemptAt: Date | null }> = [];
    const incrementFailureStreakCalls: string[] = [];
    const markPausedCalls: string[] = [];
    const eventLogCreateCalls: Array<{ result: string; errorMessage: string | null }> = [];
    const deliverCalls: string[] = [];

    const outboxRepository = {
      claimDue: async () => [],
      markDelivered: async () => {},
      markFailed: async (id: string, attemptCount: number, nextAttemptAt: Date | null) => {
        markFailedCalls.push({ id, attemptCount, nextAttemptAt });
      },
      requeueIfProcessing: async () => {},
      cancelPendingForWebhook: async () => {},
    };

    const webhookRepository = {
      findForDelivery: async () => ({
        id: "webhook-1",
        teamId: "team-1",
        name: "Hook",
        status: "active",
        targetUrl: "https://example.com/hook",
        destinationPreset: "generic",
        failureStreak: 0,
        failureThreshold: 2,
        signingSecretCipher:
          overrides.signingSecretCipher === undefined
            ? VALID_SIGNING_SECRET_CIPHER
            : overrides.signingSecretCipher,
        updatedByProfileId: "profile-1",
      }),
      resetFailureStreak: async () => {},
      incrementFailureStreak:
        overrides.incrementFailureStreak ??
        (async () => {
          incrementFailureStreakCalls.push("call");
          return { failureStreak: 1, failureThreshold: 2 };
        }),
      markPausedByFailures: async () => {
        markPausedCalls.push("paused");
      },
      findTeamMasterId: async () => null,
      createAutoPausedNotification: async () => {},
    };

    const eventLogRepository = {
      create: async (input: { result: string; errorMessage: string | null }) => {
        eventLogCreateCalls.push({ result: input.result, errorMessage: input.errorMessage });
      },
    };
    const deliveryService = {
      deliver: async () => {
        deliverCalls.push("call");
        return {
          ok: false,
          statusCode: 500,
          responseBody: null,
          errorMessage: "HTTP 500",
        };
      },
    };

    return {
      outboxRepository,
      webhookRepository,
      eventLogRepository,
      deliveryService,
      markFailedCalls,
      incrementFailureStreakCalls,
      markPausedCalls,
      eventLogCreateCalls,
      deliverCalls,
    };
  }

  it("NÃO incrementa failureStreak numa tentativa intermediária (ainda vai retentar)", async () => {
    const repos = makeRepos();
    const useCase = new ProcessWebhookOutboxUseCase(
      repos.outboxRepository as never,
      repos.webhookRepository as never,
      repos.eventLogRepository as never,
      repos.deliveryService as never
    );

    // attemptCount = 0 → esta é a 1ª tentativa; após falhar vira 1, que é < TEAM_WEBHOOK_OUTBOX_MAX_ATTEMPTS (5).
    const outcome = await (useCase as unknown as {
      processRow: (row: unknown) => Promise<string>;
    }).processRow({
      id: "outbox-1",
      teamId: "team-1",
      webhookId: "webhook-1",
      eventKey: "lead_created",
      payload: { id: "evt_1", version: 1, type: "lead_created", created_at: "now", team_id: "team-1", data: {} },
      status: "processing",
      attemptCount: 0,
      nextAttemptAt: new Date(),
    });

    expect(outcome).toBe("failed");
    expect(repos.incrementFailureStreakCalls).toHaveLength(0);
    expect(repos.markFailedCalls).toEqual([
      { id: "outbox-1", attemptCount: 1, nextAttemptAt: expect.any(Date) },
    ]);
  });

  it("T-20.4: incrementa failureStreak em +1 quando o EVENTO esgota as 5 tentativas (controle negativo: por tentativa daria 5)", async () => {
    const repos = makeRepos();
    const useCase = new ProcessWebhookOutboxUseCase(
      repos.outboxRepository as never,
      repos.webhookRepository as never,
      repos.eventLogRepository as never,
      repos.deliveryService as never
    );
    const processRow = (
      useCase as unknown as { processRow: (row: unknown) => Promise<string> }
    ).processRow.bind(useCase);

    // Simula as 5 tentativas reais do MESMO evento, uma de cada vez, exatamente como o
    // cron faria a cada retry (attemptCount sobe de 0 a 4 — TEAM_WEBHOOK_OUTBOX_MAX_ATTEMPTS = 5).
    // Controle negativo do bug W13: o código antigo incrementava a cada tentativa HTTP e
    // terminaria com 5 chamadas a incrementFailureStreak; a correção deve terminar com 1.
    const outcomes: string[] = [];
    for (let attemptCount = 0; attemptCount < 5; attemptCount += 1) {
      const outcome = await processRow({
        id: "outbox-5",
        teamId: "team-1",
        webhookId: "webhook-1",
        eventKey: "lead_created",
        payload: {
          id: "evt_5",
          version: 1,
          type: "lead_created",
          created_at: "now",
          team_id: "team-1",
          data: {},
        },
        status: "processing",
        attemptCount,
        nextAttemptAt: new Date(),
      });
      outcomes.push(outcome);
    }

    // As 4 primeiras tentativas ainda vão retentar; só a 5ª esgota o evento.
    expect(outcomes).toEqual(["failed", "failed", "failed", "failed", "failed"]);
    // Correção do bug W13: exatamente 1 incremento para 1 evento esgotado — nunca 5.
    expect(repos.incrementFailureStreakCalls).toHaveLength(1);
    expect(repos.markFailedCalls).toEqual([
      { id: "outbox-5", attemptCount: 1, nextAttemptAt: expect.any(Date) },
      { id: "outbox-5", attemptCount: 2, nextAttemptAt: expect.any(Date) },
      { id: "outbox-5", attemptCount: 3, nextAttemptAt: expect.any(Date) },
      { id: "outbox-5", attemptCount: 4, nextAttemptAt: expect.any(Date) },
      { id: "outbox-5", attemptCount: 5, nextAttemptAt: null },
    ]);
  });

  it("T-20.5: 10 eventos esgotados (failureStreak alcança failureThreshold) disparam auto-pause", async () => {
    const repos = makeRepos({
      incrementFailureStreak: async () => ({ failureStreak: 10, failureThreshold: 10 }),
    });
    const useCase = new ProcessWebhookOutboxUseCase(
      repos.outboxRepository as never,
      repos.webhookRepository as never,
      repos.eventLogRepository as never,
      repos.deliveryService as never
    );

    const outcome = await (useCase as unknown as {
      processRow: (row: unknown) => Promise<string>;
    }).processRow({
      id: "outbox-10",
      teamId: "team-1",
      webhookId: "webhook-1",
      eventKey: "lead_created",
      payload: { id: "evt_10", version: 1, type: "lead_created", created_at: "now", team_id: "team-1", data: {} },
      status: "processing",
      attemptCount: 4,
      nextAttemptAt: new Date(),
    });

    expect(outcome).toBe("paused");
    expect(repos.markPausedCalls).toEqual(["paused"]);
  });

  it("R20-6: segredo ilegível (cifra presente, decifra para null) bloqueia a entrega sem tentar HTTP", async () => {
    const repos = makeRepos({ signingSecretCipher: "lixo-nao-e-uma-cifra-valida" });
    const useCase = new ProcessWebhookOutboxUseCase(
      repos.outboxRepository as never,
      repos.webhookRepository as never,
      repos.eventLogRepository as never,
      repos.deliveryService as never
    );

    const outcome = await (useCase as unknown as {
      processRow: (row: unknown) => Promise<string>;
    }).processRow({
      id: "outbox-bad-secret",
      teamId: "team-1",
      webhookId: "webhook-1",
      eventKey: "lead_created",
      payload: { id: "evt_bad", version: 1, type: "lead_created", created_at: "now", team_id: "team-1", data: {} },
      status: "processing",
      attemptCount: 0,
      nextAttemptAt: new Date(),
    });

    expect(outcome).toBe("failed");
    // Nunca chega a fazer POST — segredo ilegível é bloqueado antes do transporte HTTP.
    expect(repos.deliverCalls).toHaveLength(0);
    expect(repos.eventLogCreateCalls).toEqual([
      {
        result: "failure",
        errorMessage: "Segredo de assinatura ilegível — entrega bloqueada por segurança",
      },
    ]);
    // Sem retry: dead-letter imediato, e conta para o streak (diferente de uma falha HTTP comum).
    expect(repos.incrementFailureStreakCalls).toHaveLength(1);
    expect(repos.markFailedCalls).toEqual([
      { id: "outbox-bad-secret", attemptCount: 1, nextAttemptAt: null },
    ]);
  });

  it("achado Codex (PR #1220): webhook sem segredo configurado (cifra nunca gravada) bloqueia a entrega sem tentar HTTP e conta pro streak, igual à cifra ilegível", async () => {
    const repos = makeRepos({ signingSecretCipher: null });
    const useCase = new ProcessWebhookOutboxUseCase(
      repos.outboxRepository as never,
      repos.webhookRepository as never,
      repos.eventLogRepository as never,
      repos.deliveryService as never
    );

    // Medido em 09/09 e reconfirmado em 22/09 (select count(*) direto no banco de
    // produção): 0 webhooks de saída cadastrados hoje — `TeamWebhookService.create()`
    // e `rotateSigningSecret()` sempre geram um segredo, então este ramo não tem
    // instância real em produção. Por isso o caminho simples basta: mesmo tratamento
    // do achado de cifra ILEGÍVEL (R20-6 acima) — bloqueio imediato, conta pro streak,
    // pode auto-pausar. Sem backoff especial, sem exceção. Ver
    // `scripts/backfill-outbound-webhook-signing-secrets.ts` para o backfill
    // defensivo de qualquer linha que viesse a existir sem segredo.
    const outcome = await (useCase as unknown as {
      processRow: (row: unknown) => Promise<string>;
    }).processRow({
      id: "outbox-no-secret",
      teamId: "team-1",
      webhookId: "webhook-1",
      eventKey: "lead_created",
      payload: { id: "evt_no_secret", version: 1, type: "lead_created", created_at: "now", team_id: "team-1", data: {} },
      status: "processing",
      attemptCount: 0,
      nextAttemptAt: new Date(),
    });

    expect(outcome).toBe("failed");
    expect(repos.deliverCalls).toHaveLength(0);
    expect(repos.eventLogCreateCalls).toEqual([
      {
        result: "failure",
        errorMessage: "Segredo de assinatura não configurado — entrega bloqueada por segurança",
      },
    ]);
    // Sem retry: dead-letter imediato, e conta para o streak — igual à cifra ilegível.
    expect(repos.incrementFailureStreakCalls).toHaveLength(1);
    expect(repos.markFailedCalls).toEqual([
      { id: "outbox-no-secret", attemptCount: 1, nextAttemptAt: null },
    ]);
  });
});
