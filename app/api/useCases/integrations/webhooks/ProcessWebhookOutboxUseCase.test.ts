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
    createdAt: new Date("2026-08-12T11:59:00.000Z"),
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

  it("achado Codex (PR #1220): webhook sem segredo configurado (cifra nunca gravada) nunca chama deliver(), mas NÃO conta para o streak", async () => {
    const repos = makeRepos({ signingSecretCipher: null });
    const useCase = new ProcessWebhookOutboxUseCase(
      repos.outboxRepository as never,
      repos.webhookRepository as never,
      repos.eventLogRepository as never,
      repos.deliveryService as never
    );

    // achado da revisão final (Opus): produção tem webhooks de saída desde 27/07, todos
    // com signingSecretCipher=null até esta migration. Se este caminho contasse pro
    // streak/auto-pause (como o caminho de cifra ILEGÍVEL faz), o primeiro deploy
    // pausaria e cancelaria a fila de TODO webhook legado de uma vez.
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
      createdAt: new Date(),
    });

    expect(outcome).toBe("failed");
    expect(repos.deliverCalls).toHaveLength(0);
    expect(repos.eventLogCreateCalls).toEqual([
      {
        result: "failure",
        errorMessage: "Segredo de assinatura não configurado — entrega em espera até a rotação",
      },
    ]);
    // Diferente do achado de cifra ILEGÍVEL: isto NÃO conta para o streak nem cancela
    // a fila — só reagenda, indefinidamente, como um estado de configuração da conta.
    expect(repos.incrementFailureStreakCalls).toHaveLength(0);
    expect(repos.markFailedCalls).toHaveLength(1);
    expect(repos.markFailedCalls[0]?.id).toBe("outbox-no-secret");
    // attemptCount 0 na entrada → 0 na saída: este ramo NUNCA avança attemptCount.
    expect(repos.markFailedCalls[0]?.attemptCount).toBe(0);
    // Evento recém-criado (createdAt=agora) → 1º degrau: reagenda em ~15min
    // (tolerância de 5s pro tempo de execução do teste).
    const delayMs = (repos.markFailedCalls[0]?.nextAttemptAt?.getTime() ?? 0) - Date.now();
    expect(delayMs).toBeGreaterThan(15 * 60 * 1000 - 5000);
    expect(delayMs).toBeLessThan(15 * 60 * 1000 + 5000);
  });

  it("achado da 4ª revisão final (Opus): attemptCount fica intocado por falta de segredo — não herda orçamento de tentativas HTTP depois da rotação", async () => {
    const repos = makeRepos({ signingSecretCipher: null });
    const useCase = new ProcessWebhookOutboxUseCase(
      repos.outboxRepository as never,
      repos.webhookRepository as never,
      repos.eventLogRepository as never,
      repos.deliveryService as never
    );

    // Achado da 4ª revisão: a correção anterior (b86b9cb2a) reaproveitava attemptCount
    // como contador de adiamentos. Um evento adiado várias vezes por falta de segredo
    // herdava um attemptCount alto, e um único 5xx real APÓS a rotação já esgotava
    // TEAM_WEBHOOK_OUTBOX_MAX_ATTEMPTS=5 — dead-letter e auto-pause sem nenhuma
    // retentativa de verdade. Aqui simulamos exatamente esse attemptCount "herdado"
    // (47, bem acima do limite de tentativas HTTP) para provar que este ramo o
    // ignora e o devolve INTOCADO — nunca soma, nunca lê para decidir o atraso.
    const outcome = await (useCase as unknown as {
      processRow: (row: unknown) => Promise<string>;
    }).processRow({
      id: "outbox-no-secret-inherited-attempts",
      teamId: "team-1",
      webhookId: "webhook-1",
      eventKey: "lead_created",
      payload: {
        id: "evt_no_secret_inherited",
        version: 1,
        type: "lead_created",
        created_at: "now",
        team_id: "team-1",
        data: {},
      },
      status: "processing",
      attemptCount: 47,
      nextAttemptAt: new Date(),
      createdAt: new Date(),
    });

    expect(outcome).toBe("failed");
    expect(repos.deliverCalls).toHaveLength(0);
    expect(repos.incrementFailureStreakCalls).toHaveLength(0);
    expect(repos.markPausedCalls).toHaveLength(0);
    expect(repos.markFailedCalls).toHaveLength(1);
    // attemptCount devolvido é EXATAMENTE o de entrada — nunca incrementado, nunca
    // zerado: o orçamento de tentativas HTTP fica limpo para quando o segredo for
    // rotacionado e a entrega real (fora deste ramo) voltar a valer.
    expect(repos.markFailedCalls[0]?.attemptCount).toBe(47);
    expect(repos.markFailedCalls[0]?.nextAttemptAt).not.toBeNull();
  });

  it("achado da 3ª/4ª revisões finais (Opus): o reagendamento por falta de segredo cresce com o TEMPO real de espera (não com attemptCount), até um teto de 24h", async () => {
    const repos = makeRepos({ signingSecretCipher: null });
    const useCase = new ProcessWebhookOutboxUseCase(
      repos.outboxRepository as never,
      repos.webhookRepository as never,
      repos.eventLogRepository as never,
      repos.deliveryService as never
    );
    const processRow = (
      useCase as unknown as { processRow: (row: unknown) => Promise<string> }
    ).processRow.bind(useCase);

    // Achado da 3ª revisão: um intervalo FIXO (15min pra sempre) deixava um único
    // webhook parado monopolizar a capacidade global do cron (a cada 5min,
    // BATCH_SIZE=25 — vercel.json). Achado da 4ª revisão: crescer esse atraso via
    // attemptCount persistido quebrava o orçamento de tentativas HTTP após a rotação
    // (ver teste acima). Por isso o atraso é function de QUANTO TEMPO o evento já
    // espera (`row.createdAt`), nunca de attemptCount — cada waitingSinceMs abaixo
    // simula um evento criado há X tempo, sempre com o MESMO attemptCount de entrada
    // (3, escolhido arbitrariamente para provar que ele nunca é lido nem alterado).
    const cases: Array<{ waitingSinceMs: number; expectedDelayMinutes: number }> = [
      { waitingSinceMs: 0, expectedDelayMinutes: 15 }, // recém-criado: 1º degrau
      { waitingSinceMs: 30 * 60 * 1000, expectedDelayMinutes: 15 }, // 30min: ainda no 1º degrau (<1h)
      { waitingSinceMs: 90 * 60 * 1000, expectedDelayMinutes: 60 }, // 1h30: 2º degrau (1h-4h)
      { waitingSinceMs: 5 * 60 * 60 * 1000, expectedDelayMinutes: 240 }, // 5h: 3º degrau (4h-24h)
      { waitingSinceMs: 25 * 60 * 60 * 1000, expectedDelayMinutes: 1440 }, // 25h: teto (24h)
      { waitingSinceMs: 200 * 60 * 60 * 1000, expectedDelayMinutes: 1440 }, // 200h: continua no teto
    ];

    for (const { waitingSinceMs, expectedDelayMinutes } of cases) {
      const before = Date.now();
      const outcome = await processRow({
        id: `outbox-no-secret-${waitingSinceMs}`,
        teamId: "team-1",
        webhookId: "webhook-1",
        eventKey: "lead_created",
        payload: {
          id: "evt_no_secret_tier",
          version: 1,
          type: "lead_created",
          created_at: "now",
          team_id: "team-1",
          data: {},
        },
        status: "processing",
        attemptCount: 3,
        nextAttemptAt: new Date(),
        createdAt: new Date(before - waitingSinceMs),
      });
      expect(outcome).toBe("failed");
      const call = repos.markFailedCalls[repos.markFailedCalls.length - 1];
      // attemptCount nunca muda, em NENHUM degrau.
      expect(call?.attemptCount).toBe(3);
      const observedDelayMs = (call?.nextAttemptAt?.getTime() ?? 0) - before;
      const expectedDelayMs = expectedDelayMinutes * 60 * 1000;
      expect(observedDelayMs).toBeGreaterThan(expectedDelayMs - 5000);
      expect(observedDelayMs).toBeLessThan(expectedDelayMs + 5000);
    }

    expect(repos.deliverCalls).toHaveLength(0);
    expect(repos.incrementFailureStreakCalls).toHaveLength(0);
    expect(repos.markPausedCalls).toHaveLength(0);
    expect(repos.markFailedCalls).toHaveLength(cases.length);
    // nextAttemptAt nunca é null em nenhum degrau — nunca vira dead-letter.
    repos.markFailedCalls.forEach((call) => {
      expect(call.nextAttemptAt).not.toBeNull();
    });
  });
});
