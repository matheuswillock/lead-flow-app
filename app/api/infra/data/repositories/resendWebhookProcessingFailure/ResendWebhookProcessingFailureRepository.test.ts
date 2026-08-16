import { beforeEach, describe, expect, it, mock, spyOn } from "bun:test";
import { RESEND_WEBHOOK_PROCESSING_FAILURE_MAX_ATTEMPTS } from "@/lib/email/resend-webhook-processing-failure-backoff";

/** Espelha o valor privado do repositório só para checar o cálculo de `staleBefore` nos testes. */
const STALE_PROCESSING_MS = 10 * 60 * 1000;

const updateManyMock = mock(async () => ({ count: 1 }));
const upsertMock = mock(async () => ({}));
const findUniqueMock = mock(async () => null);

/**
 * `claimDue` faz duas chamadas de `$queryRaw` (recovery de leases travados +
 * claim atômico). Como as duas passam pelo mesmo método mockado do prisma,
 * dividimos em dois mocks dedicados (`staleRecoveryQueryMock` /
 * `claimQueryMock`) e um dispatcher que decide qual chamar inspecionando o
 * texto do SQL — assim cada teste consegue inspecionar params/retorno de
 * cada query isoladamente, sem depender da ordem das chamadas.
 */
const staleRecoveryQueryMock = mock(async (..._args: unknown[]): Promise<unknown[]> => []);
const claimQueryMock = mock(async (..._args: unknown[]): Promise<unknown[]> => []);

const queryRawMock = mock(
  async (strings: TemplateStringsArray, ...values: unknown[]): Promise<unknown[]> => {
    const sql = strings.join("");
    if (sql.includes("WITH claimed AS")) {
      return claimQueryMock(...values);
    }
    return staleRecoveryQueryMock(...values);
  }
);

mock.module("@/app/api/infra/data/prisma", () => ({
  prisma: {
    resendWebhookProcessingFailure: {
      updateMany: updateManyMock,
      upsert: upsertMock,
      findUnique: findUniqueMock,
    },
    $queryRaw: queryRawMock,
  },
}));

const { ResendWebhookProcessingFailureRepository } = await import(
  "./ResendWebhookProcessingFailureRepository"
);

describe("ResendWebhookProcessingFailureRepository (D11)", () => {
  beforeEach(() => {
    updateManyMock.mockClear();
    upsertMock.mockClear();
    findUniqueMock.mockClear();
    queryRawMock.mockClear();
    staleRecoveryQueryMock.mockClear();
    claimQueryMock.mockClear();
    updateManyMock.mockImplementation(async () => ({ count: 1 }));
    staleRecoveryQueryMock.mockImplementation(async () => []);
    claimQueryMock.mockImplementation(async () => []);
  });

  it("claimDue chama a query de recovery de leases travados com staleBefore e MAX_ATTEMPTS corretos", async () => {
    const repo = new ResendWebhookProcessingFailureRepository();
    const before = Date.now();
    await repo.claimDue(10);
    const after = Date.now();

    expect(staleRecoveryQueryMock).toHaveBeenCalledTimes(1);
    const [maxAttempts1, maxAttempts2, now, staleBefore] = staleRecoveryQueryMock.mock
      .calls[0] as [number, number, Date, Date];

    expect(maxAttempts1).toBe(RESEND_WEBHOOK_PROCESSING_FAILURE_MAX_ATTEMPTS);
    expect(maxAttempts2).toBe(RESEND_WEBHOOK_PROCESSING_FAILURE_MAX_ATTEMPTS);
    expect(now.getTime()).toBeGreaterThanOrEqual(before);
    expect(now.getTime()).toBeLessThanOrEqual(after);
    expect(staleBefore.getTime()).toBe(now.getTime() - STALE_PROCESSING_MS);
  });

  it("recovery de leases travados é uma única query atômica — não chama findMany/updateMany por linha", async () => {
    staleRecoveryQueryMock.mockImplementation(async () => [
      { id: "row-stale", status: "pending" },
    ]);

    const repo = new ResendWebhookProcessingFailureRepository();
    await repo.claimDue(10);

    expect(staleRecoveryQueryMock).toHaveBeenCalledTimes(1);
    expect(updateManyMock).not.toHaveBeenCalled();
  });

  it("loga quantas linhas de recovery foram reenfileiradas (pending) vs esgotadas (failed)", async () => {
    const consoleInfoSpy = spyOn(console, "info").mockImplementation(() => {});
    staleRecoveryQueryMock.mockImplementation(async () => [
      { id: "row-a", status: "pending" },
      { id: "row-b", status: "failed" },
      { id: "row-c", status: "pending" },
    ]);

    const repo = new ResendWebhookProcessingFailureRepository();
    await repo.claimDue(10);

    expect(consoleInfoSpy).toHaveBeenCalledWith(
      "[ResendWebhookProcessingFailureRepository] Leases abandonados recuperados",
      { total: 3, requeued: 2, exhausted: 1 }
    );

    consoleInfoSpy.mockRestore();
  });

  it("não loga recovery quando não há leases travados", async () => {
    const consoleInfoSpy = spyOn(console, "info").mockImplementation(() => {});
    staleRecoveryQueryMock.mockImplementation(async () => []);

    const repo = new ResendWebhookProcessingFailureRepository();
    await repo.claimDue(10);

    expect(consoleInfoSpy).not.toHaveBeenCalledWith(
      "[ResendWebhookProcessingFailureRepository] Leases abandonados recuperados",
      expect.anything()
    );

    consoleInfoSpy.mockRestore();
  });

  it("claimDue usa uma única query atômica (FOR UPDATE SKIP LOCKED) para reservar o lote", async () => {
    claimQueryMock.mockImplementation(async () => [
      {
        id: "row-1",
        svixId: "svix-1",
        eventType: "email.delivered",
        payload: { foo: "bar" },
        attemptCount: 1,
      },
    ]);

    const repo = new ResendWebhookProcessingFailureRepository();
    const claimed = await repo.claimDue(2000);

    expect(claimQueryMock).toHaveBeenCalledTimes(1);
    expect(updateManyMock).not.toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ id: "row-1" }) })
    );
    expect(claimed).toEqual([
      {
        id: "row-1",
        svixId: "svix-1",
        eventType: "email.delivered",
        payload: { foo: "bar" },
        attemptCount: 1,
      },
    ]);
  });

  it("claimDue com limit 0 não consulta o banco", async () => {
    const repo = new ResendWebhookProcessingFailureRepository();
    const claimed = await repo.claimDue(0);
    expect(claimed).toEqual([]);
    expect(queryRawMock).not.toHaveBeenCalled();
    expect(staleRecoveryQueryMock).not.toHaveBeenCalled();
    expect(claimQueryMock).not.toHaveBeenCalled();
  });

  it("claimDue converte attemptCount bigint retornado pelo Postgres para number", async () => {
    claimQueryMock.mockImplementation(async () => [
      {
        id: "row-2",
        svixId: "svix-2",
        eventType: "email.bounced",
        payload: { foo: "baz" },
        attemptCount: BigInt(3),
      },
    ]);

    const repo = new ResendWebhookProcessingFailureRepository();
    const [claimed] = await repo.claimDue(5);

    expect(claimed?.attemptCount).toBe(3);
    expect(typeof claimed?.attemptCount).toBe("number");
  });
});
