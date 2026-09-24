import { beforeEach, describe, expect, it, mock } from "bun:test"

const addBreadcrumbMock = mock((_breadcrumb: Record<string, unknown>) => {})
const captureMessageMock = mock((_message: string, _context?: Record<string, unknown>) => "")

mock.module("@sentry/nextjs", () => ({
  addBreadcrumb: addBreadcrumbMock,
  captureMessage: captureMessageMock,
}))

const { extractAsaasEntityIdPrefix, recordAsaasRequestBreadcrumb, reportAsaasLegacy404 } =
  await import("./asaas-observability")

describe("extractAsaasEntityIdPrefix", () => {
  it.each([
    ["https://api.asaas.com/v3/customers/cus_000123", "cus"],
    ["https://api.asaas.com/v3/subscriptions/sub_abc123", "sub"],
    ["https://api.asaas.com/v3/payments/pay_xyz789", "pay"],
    ["https://api.asaas.com/v3/customers", null],
    ["https://api.asaas.com/v3/customers/cus_1/notifications", "cus"],
  ])("%s -> %s", (endpoint, expected) => {
    expect(extractAsaasEntityIdPrefix(endpoint)).toBe(expected as never)
  })
})

describe("recordAsaasRequestBreadcrumb (T-30.23 — E7/X3)", () => {
  beforeEach(() => {
    addBreadcrumbMock.mockClear()
  })

  it("toda chamada carrega a tag de conta (asaasAccount) e o entityIdPrefix", () => {
    recordAsaasRequestBreadcrumb({
      asaasAccount: "legacy",
      entityIdPrefix: "cus",
      endpoint: "https://api.asaas.com/v3/customers/cus_1",
    })

    expect(addBreadcrumbMock).toHaveBeenCalledWith(
      expect.objectContaining({
        category: "asaas",
        data: expect.objectContaining({ asaasAccount: "legacy", entityIdPrefix: "cus" }),
      })
    )
  })

})

describe("reportAsaasLegacy404 (T-30.23 — E7/X3)", () => {
  beforeEach(() => {
    captureMessageMock.mockClear()
  })

  it("dispara captureMessage com fingerprint dedicado, distinto de 404 genérico", () => {
    reportAsaasLegacy404({
      entityIdPrefix: "sub",
      endpoint: "https://api.asaas.com/v3/subscriptions/sub_dead",
    })

    expect(captureMessageMock).toHaveBeenCalledTimes(1)
    const [message, context] = captureMessageMock.mock.calls[0] as [
      string,
      { tags: Record<string, string>; fingerprint: string[] },
    ]
    expect(message).toMatch(/404/)
    expect(context.tags).toEqual(
      expect.objectContaining({
        asaasAccount: "legacy",
        asaasEntityIdPrefix: "sub",
        alertType: "asaas-legacy-404",
      })
    )
    expect(context.fingerprint).toEqual(["asaas-legacy-404", "sub"])
  })
})
