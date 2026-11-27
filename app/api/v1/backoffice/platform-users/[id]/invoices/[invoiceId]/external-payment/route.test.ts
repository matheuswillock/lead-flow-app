import { beforeEach, describe, expect, it, mock } from "bun:test"
import type { NextRequest } from "next/server"
import { Output } from "@/lib/output"

const getBackofficeAccessMock = mock(async (): Promise<any> => ({
  access: {
    profileId: "op-1",
    backofficeUserId: "bo-1",
    backofficeEmail: "ops@corretorstudio.com",
    role: "manager",
  },
}))

const requireManagerAccessMock = mock((): any => null)

const markPaidExternallyMock = mock(
  async (): Promise<Output> =>
    new Output(true, ["Fatura marcada como paga externamente com sucesso"], [], {
      id: "pending-action-pa-1",
    })
)

mock.module("@/app/api/v1/backoffice/utils/getBackofficeAccess", () => ({
  getBackofficeAccess: getBackofficeAccessMock,
}))

mock.module("@/app/api/v1/backoffice/utils/requireManagerAccess", () => ({
  requireManagerAccess: requireManagerAccessMock,
}))

mock.module("@/app/api/useCases/backoffice/BackofficePlatformUsersUseCase", () => ({
  backofficePlatformUsersUseCase: {
    markMasterUserInvoicePaidExternally: markPaidExternallyMock,
  },
}))

const { POST } = await import("./route")

function makeRequest(body: unknown): NextRequest {
  return new Request(
    "http://localhost:3000/api/v1/backoffice/platform-users/master-1/invoices/pending-action-pa-1/external-payment",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }
  ) as unknown as NextRequest
}

describe("POST /api/v1/backoffice/platform-users/[id]/invoices/[invoiceId]/external-payment", () => {
  beforeEach(() => {
    getBackofficeAccessMock.mockClear()
    requireManagerAccessMock.mockClear()
    markPaidExternallyMock.mockClear()
  })

  it("rejeita quando referência não é informada", async () => {
    const res = await POST(makeRequest({ reference: "  " }), {
      params: Promise.resolve({ id: "master-1", invoiceId: "pending-action-pa-1" }),
    })

    expect(res.status).toBe(400)
    expect(markPaidExternallyMock).not.toHaveBeenCalled()
  })

  it("chama useCase e retorna 200 em sucesso", async () => {
    const res = await POST(
      makeRequest({ reference: "PIX-01", proofUrl: "https://example.com/recibo.png" }),
      {
        params: Promise.resolve({ id: "master-1", invoiceId: "pending-action-pa-1" }),
      }
    )

    expect(res.status).toBe(200)
    expect(markPaidExternallyMock).toHaveBeenCalledWith(
      "master-1",
      "pending-action-pa-1",
      { reference: "PIX-01", proofUrl: "https://example.com/recibo.png", paidAt: null },
      {
        profileId: "op-1",
        backofficeUserId: "bo-1",
        backofficeEmail: "ops@corretorstudio.com",
      }
    )
  })
})
