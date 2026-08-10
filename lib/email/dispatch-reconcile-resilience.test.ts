import { beforeEach, describe, expect, it, mock } from "bun:test";
import { withPrismaRetry } from "@/app/api/infra/data/prisma";

const emailLogCountMock = mock(async () => 795);
const dispatchUpdateManyMock = mock(async () => ({ count: 1 }));

mock.module("@/app/api/infra/data/prisma", () => ({
  prisma: {
    emailLog: { count: emailLogCountMock },
    emailCampaignDispatch: { updateMany: dispatchUpdateManyMock },
    $connect: mock(async () => {}),
  },
  withPrismaRetry,
}));

const { countSuccessfulDispatchLogs, persistDispatchTotalSentFallback } = await import(
  "./dispatch-reconcile-resilience"
);

describe("dispatch-reconcile-resilience helpers (D10)", () => {
  beforeEach(() => {
    emailLogCountMock.mockClear();
    dispatchUpdateManyMock.mockClear();
    emailLogCountMock.mockImplementation(async () => 795);
    dispatchUpdateManyMock.mockImplementation(async () => ({ count: 1 }));
  });

  it("countSuccessfulDispatchLogs usa status de sucesso do EmailLog", async () => {
    await countSuccessfulDispatchLogs("dispatch-abc");

    expect(emailLogCountMock).toHaveBeenCalledTimes(1);
    const args = (emailLogCountMock.mock.calls as unknown as Array<
      [{ where: { dispatchId: string; status: { in: string[] } } }]
    >)[0]![0];
    expect(args.where.dispatchId).toBe("dispatch-abc");
    expect(args.where.status.in).toEqual(["sent", "delivered", "opened", "clicked"]);
  });

  it("persistDispatchTotalSentFallback grava totalSent real sem transação", async () => {
    const ok = await persistDispatchTotalSentFallback({
      dispatchId: "dispatch-abc",
      sentCount: 795,
      errorMessage: "Erro interno durante o disparo",
    });

    expect(ok).toBe(true);
    expect(dispatchUpdateManyMock).toHaveBeenCalledTimes(1);
    const args = (dispatchUpdateManyMock.mock.calls as unknown as Array<
      [{ where: { id: string }; data: { totalSent: number; errorMessage: string } }]
    >)[0]![0];
    expect(args.where.id).toBe("dispatch-abc");
    expect(args.data.totalSent).toBe(795);
    expect(args.data.totalSent).not.toBe(0);
  });

  it("simula timeout persistente no commit: fallback garante totalSent > 0 quando há logs sent", async () => {
    const sentCount = await countSuccessfulDispatchLogs("dispatch-fail-all-retries");
    expect(sentCount).toBe(795);

    const fallbackOk = await persistDispatchTotalSentFallback({
      dispatchId: "dispatch-fail-all-retries",
      sentCount,
    });

    expect(fallbackOk).toBe(true);
    const args = (dispatchUpdateManyMock.mock.calls as unknown as Array<
      [{ data: { totalSent: number } }]
    >)[0]![0];
    expect(args.data.totalSent).toBe(795);
    expect(args.data.totalSent).not.toBe(0);
  });
});
