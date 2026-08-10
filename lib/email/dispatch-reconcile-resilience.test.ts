import { beforeEach, describe, expect, it, mock } from "bun:test";

const emailLogCountMock = mock(async () => 795);
const campaignUpdateManyMock = mock(async () => ({ count: 1 }));
const dispatchFindUniqueMock = mock(async () => ({ status: "sending" }));
const dispatchUpdateManyMock = mock(async () => ({ count: 1 }));

mock.module("@/app/api/infra/data/prisma", () => ({
  prisma: {
    emailLog: { count: emailLogCountMock },
    emailCampaign: { updateMany: campaignUpdateManyMock },
    emailCampaignDispatch: {
      findUnique: dispatchFindUniqueMock,
      updateMany: dispatchUpdateManyMock,
    },
    $connect: mock(async () => {}),
  },
}));

const { countSuccessfulDispatchLogs, persistDispatchTerminalFallback } = await import(
  "./dispatch-reconcile-resilience"
);

describe("dispatch-reconcile-resilience helpers (D10)", () => {
  beforeEach(() => {
    emailLogCountMock.mockClear();
    campaignUpdateManyMock.mockClear();
    dispatchFindUniqueMock.mockClear();
    dispatchUpdateManyMock.mockClear();
    emailLogCountMock.mockImplementation(async () => 795);
    campaignUpdateManyMock.mockImplementation(async () => ({ count: 1 }));
    dispatchFindUniqueMock.mockImplementation(async () => ({ status: "sending" }));
    dispatchUpdateManyMock.mockImplementation(async () => ({ count: 1 }));
  });

  it("countSuccessfulDispatchLogs conta EmailLog com sentAt preenchido", async () => {
    await countSuccessfulDispatchLogs("dispatch-abc");

    expect(emailLogCountMock).toHaveBeenCalledTimes(1);
    const args = (emailLogCountMock.mock.calls as unknown as Array<
      [{ where: { dispatchId: string; sentAt: { not: null } } }]
    >)[0]![0];
    expect(args.where.dispatchId).toBe("dispatch-abc");
    expect(args.where.sentAt).toEqual({ not: null });
  });

  it("persistDispatchTerminalFallback grava totalSent e status terminal sem transação", async () => {
    const ok = await persistDispatchTerminalFallback({
      campaignId: "campaign-abc",
      dispatchId: "dispatch-abc",
      sentCount: 795,
      terminal: {
        campaignStatus: "sent",
        dispatchStatus: "completed",
        errorMessage: null,
      },
      totalRecipients: 800,
    });

    expect(ok).toBe(true);
    expect(campaignUpdateManyMock).toHaveBeenCalledTimes(1);
    expect(dispatchUpdateManyMock).toHaveBeenCalledTimes(1);

    const campaignArgs = (campaignUpdateManyMock.mock.calls as unknown as Array<
      [
        {
          where: { id: string; status: string };
          data: { status: string; totalSent: { increment: number } };
        },
      ]
    >)[0]![0];
    expect(campaignArgs.where.id).toBe("campaign-abc");
    expect(campaignArgs.data.status).toBe("sent");
    expect(campaignArgs.data.totalSent.increment).toBe(795);

    const dispatchArgs = (dispatchUpdateManyMock.mock.calls as unknown as Array<
      [{ where: { id: string; status: string }; data: { totalSent: number; status: string } }]
    >)[0]![0];
    expect(dispatchArgs.where.id).toBe("dispatch-abc");
    expect(dispatchArgs.data.totalSent).toBe(795);
    expect(dispatchArgs.data.status).toBe("completed");
  });

  it("simula timeout persistente no commit: fallback garante totalSent > 0 quando há logs sent", async () => {
    const sentCount = await countSuccessfulDispatchLogs("dispatch-fail-all-retries");
    expect(sentCount).toBe(795);

    const fallbackOk = await persistDispatchTerminalFallback({
      campaignId: "campaign-fail",
      dispatchId: "dispatch-fail-all-retries",
      sentCount,
      terminal: {
        campaignStatus: "sent",
        dispatchStatus: "completed",
        errorMessage: null,
      },
    });

    expect(fallbackOk).toBe(true);
    const args = (dispatchUpdateManyMock.mock.calls as unknown as Array<
      [{ data: { totalSent: number } }]
    >)[0]![0];
    expect(args.data.totalSent).toBe(795);
    expect(args.data.totalSent).not.toBe(0);
  });
});
