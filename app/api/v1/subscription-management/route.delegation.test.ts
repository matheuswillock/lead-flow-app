import { beforeEach, describe, expect, it, mock } from "bun:test";
import { NextRequest, NextResponse } from "next/server";

let currentAccess = { isMaster: false, canManageAccountTeams: false };

const getSubscription = mock(async () => ({ isValid: true, result: { id: "sub-1" } }));
const cancelSubscription = mock(async () => ({ isValid: true, result: {} }));
const updateCredits = mock(async () => ({ isValid: true, result: {} }));
const getInvoices = mock(async () => ({ isValid: true, result: [] }));
const retryPayment = mock(async () => ({ isValid: true, result: {} }));
const updatePaymentMethod = mock(async () => ({ isValid: true, result: {} }));
const syncSubscription = mock(async () => ({ isValid: true, result: {} }));

mock.module("next/server", () => ({
  NextRequest,
  NextResponse,
  connection: mock(async () => undefined),
}));
mock.module("@/lib/http/rethrow-if-prerender-interrupted", () => ({
  rethrowIfPrerenderInterrupted: () => undefined,
}));
mock.module("@/app/api/v1/utils/requireActiveAccountAccess", () => ({
  requireActiveAccountAccess: mock(async () => null),
  requireWritableAccountAccess: mock(async () => null),
}));
mock.module("@/app/api/v1/utils/teamAccess", () => ({
  getTeamAccess: mock(async () => ({ access: currentAccess })),
  hasDelegatedTeamManagementAccess: (access: {
    isMaster: boolean;
    canManageAccountTeams: boolean;
  }) => access.isMaster || access.canManageAccountTeams,
}));
mock.module("@/app/api/useCases/subscriptionManagement/SubscriptionManagementUseCase", () => ({
  subscriptionManagementUseCase: {
    getSubscription,
    cancelSubscription,
    updateCredits,
    getInvoices,
    retryPayment,
    updatePaymentMethod,
    syncSubscription,
  },
}));

const { GET, DELETE } = await import("./route");
const { POST: postCredits } = await import("./credits/route");
const { GET: getInvoicesRoute } = await import("./invoices/route");
const { POST: postRetry } = await import("./invoices/retry/route");
const { POST: postPaymentMethod } = await import("./payment-method/route");
const { POST: postSync } = await import("./sync/route");

function makeReq(method: string, url: string, body?: unknown) {
  return new NextRequest(url, {
    method,
    headers: {
      "x-supabase-user-id": "user-1",
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
}

describe("subscription-management — restrição a master ou delegado (Fase E)", () => {
  beforeEach(() => {
    currentAccess = { isMaster: false, canManageAccountTeams: false };
    getSubscription.mockClear();
    cancelSubscription.mockClear();
    updateCredits.mockClear();
    getInvoices.mockClear();
    retryPayment.mockClear();
    updatePaymentMethod.mockClear();
    syncSubscription.mockClear();
  });

  it("nega acesso (403) em todas as rotas para quem não é master nem delegado", async () => {
    const responses = await Promise.all([
      GET(makeReq("GET", "http://localhost/api/v1/subscription-management")),
      DELETE(makeReq("DELETE", "http://localhost/api/v1/subscription-management")),
      postCredits(makeReq("POST", "http://localhost/api/v1/subscription-management/credits", { credits: 1 })),
      getInvoicesRoute(makeReq("GET", "http://localhost/api/v1/subscription-management/invoices")),
      postRetry(makeReq("POST", "http://localhost/api/v1/subscription-management/invoices/retry", { invoiceId: "inv-1" })),
      postPaymentMethod(makeReq("POST", "http://localhost/api/v1/subscription-management/payment-method", {})),
      postSync(makeReq("POST", "http://localhost/api/v1/subscription-management/sync")),
    ]);

    for (const res of responses) {
      expect(res.status).toBe(403);
    }
    expect(getSubscription).not.toHaveBeenCalled();
    expect(cancelSubscription).not.toHaveBeenCalled();
    expect(updateCredits).not.toHaveBeenCalled();
    expect(getInvoices).not.toHaveBeenCalled();
    expect(retryPayment).not.toHaveBeenCalled();
    expect(updatePaymentMethod).not.toHaveBeenCalled();
    expect(syncSubscription).not.toHaveBeenCalled();
  });

  it("permite acesso (200) para delegado com canManageAccountTeams e para master", async () => {
    currentAccess = { isMaster: false, canManageAccountTeams: true };
    const delegatedRes = await GET(makeReq("GET", "http://localhost/api/v1/subscription-management"));
    expect(delegatedRes.status).toBe(200);

    currentAccess = { isMaster: true, canManageAccountTeams: false };
    const masterRes = await getInvoicesRoute(
      makeReq("GET", "http://localhost/api/v1/subscription-management/invoices")
    );
    expect(masterRes.status).toBe(200);
  });
});
