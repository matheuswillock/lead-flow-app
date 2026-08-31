import { beforeEach, describe, expect, it, mock } from "bun:test"
import type {
  BackofficeAdhesionWithRelations,
  IBackofficeAdhesionRepository,
} from "@/app/api/infra/data/repositories/backoffice/backofficeAdhesion/IBackofficeAdhesionRepository"

// C33: syncPaymentStatusFromAsaas conhece a conta da própria adesão
// (adhesion.asaasAccount), mas até aqui buscava a cobrança sempre via
// asaasFetch/asaasApi — cliente fixo na conta primary. Uma adesão legacy
// (default de todo dado pré-migration) seria sincronizada contra a conta
// errada (achado cursor[bot] no PR #1100, RUN_ID bc-689f4ee9).
const requestMock = mock(async (_endpoint: string, _init?: RequestInit) => ({
  id: "pay_legacy_1",
  status: "PENDING",
}))
const createAsaasClientMock = mock((accountId: string) => ({
  endpoints: { payments: `https://asaas.test/${accountId}/payments` },
  request: requestMock,
}))
const asaasFetchMock = mock(async () => {
  throw new Error(
    "asaasFetch (conta fixa primary) não deveria ser chamado por syncPaymentStatusFromAsaas"
  )
})
mock.module("@/lib/asaas", () => ({
  asaasFetch: asaasFetchMock,
  asaasApi: { payments: "https://asaas.test/primary/payments" },
  createAsaasClient: createAsaasClientMock,
}))

const { BackofficeAdhesionService } = await import("./BackofficeAdhesionService")

function buildAdhesion(
  overrides: Partial<BackofficeAdhesionWithRelations>
): BackofficeAdhesionWithRelations {
  return {
    id: "adhesion-1",
    asaasPaymentId: "pay_legacy_1",
    asaasAccount: "legacy",
    ...overrides,
  } as BackofficeAdhesionWithRelations
}

describe("BackofficeAdhesionService.syncPaymentStatusFromAsaas — busca na conta da adesão (C33)", () => {
  beforeEach(() => {
    requestMock.mockClear()
    createAsaasClientMock.mockClear()
    asaasFetchMock.mockClear()
    requestMock.mockImplementation(async () => ({ id: "pay_legacy_1", status: "PENDING" }))
  })

  it("adesão legacy → busca via createAsaasClient('legacy'), nunca via asaasFetch fixo", async () => {
    const repo = {} as unknown as IBackofficeAdhesionRepository
    const service = new BackofficeAdhesionService(repo)
    const adhesion = buildAdhesion({ asaasAccount: "legacy" })

    await (service as any).syncPaymentStatusFromAsaas(adhesion)

    expect(createAsaasClientMock).toHaveBeenCalledWith("legacy")
    expect(requestMock).toHaveBeenCalledTimes(1)
    expect(requestMock.mock.calls[0][0]).toContain("/legacy/payments/pay_legacy_1")
    expect(asaasFetchMock).not.toHaveBeenCalled()
  })

  it("adesão primary → busca via createAsaasClient('primary')", async () => {
    const repo = {} as unknown as IBackofficeAdhesionRepository
    const service = new BackofficeAdhesionService(repo)
    const adhesion = buildAdhesion({ asaasAccount: "primary", asaasPaymentId: "pay_primary_1" })
    requestMock.mockImplementation(async () => ({ id: "pay_primary_1", status: "PENDING" }))

    await (service as any).syncPaymentStatusFromAsaas(adhesion)

    expect(createAsaasClientMock).toHaveBeenCalledWith("primary")
    expect(requestMock.mock.calls[0][0]).toContain("/primary/payments/pay_primary_1")
  })

  it("sem asaasPaymentId → não chama o Asaas em nenhuma conta", async () => {
    const repo = {} as unknown as IBackofficeAdhesionRepository
    const service = new BackofficeAdhesionService(repo)
    const adhesion = buildAdhesion({ asaasPaymentId: null })

    const result = await (service as any).syncPaymentStatusFromAsaas(adhesion)

    expect(result).toBe(adhesion)
    expect(createAsaasClientMock).not.toHaveBeenCalled()
  })
})
