import { beforeEach, describe, expect, it, mock } from "bun:test"
import type {
  BackofficeAdhesionWithRelations,
  IBackofficeAdhesionRepository,
} from "@/app/api/infra/data/repositories/backoffice/backofficeAdhesion/IBackofficeAdhesionRepository"

// getFullUrl("/set-password") roda antes do guard no fluxo real — sem isso o
// teste falha por ambiente (env local do agente), não por regressão de
// código (agents.md, "teste que não sabe falhar não é verificação").
process.env.NEXT_PUBLIC_APP_URL ??= "https://app.test.local"

// 20 — Assinaturas — Backend E7 (T-20.21). ensureAccountForPaidAdhesion
// importa AsaasCustomerGateway (via createAsaasClient/asaasFetch) mesmo
// quando o guard rejeita antes de qualquer chamada Asaas — mock completo por
// segurança (mock.module parcial contamina a suíte, agents.md).
mock.module("@/lib/asaas", () => ({
  createAsaasClient: mock(() => ({ endpoints: {}, request: mock(async () => ({})) })),
  asaasFetch: mock(async () => ({ id: "cus_unused" })),
  asaasApi: { customers: "https://asaas.test/primary/customers" },
}))

const generateLinkMock = mock(async () => ({
  data: {
    user: { id: "auth-user-1" },
    properties: { action_link: "https://x/set-password" },
  },
  error: null,
}))
const deleteUserMock = mock(async () => ({ data: {}, error: null }))
mock.module("@/lib/supabase/server", () => ({
  createSupabaseAdmin: () => ({
    auth: { admin: { generateLink: generateLinkMock, deleteUser: deleteUserMock } },
  }),
}))

const { BackofficeAdhesionService } = await import("./BackofficeAdhesionService")

function buildAdhesion(
  overrides: Partial<BackofficeAdhesionWithRelations>,
): BackofficeAdhesionWithRelations {
  return {
    id: "adhesion-guard-1",
    email: "cliente@example.test",
    fullName: "Cliente Teste",
    cycle: "monthly",
    paidAt: new Date("2026-07-20T00:00:00.000Z"),
    createdSupabaseId: null,
    createdProfileId: null,
    ...overrides,
  } as BackofficeAdhesionWithRelations
}

describe("BackofficeAdhesionService — guard de assinatura na origem (T-20.21)", () => {
  beforeEach(() => {
    generateLinkMock.mockClear()
    deleteUserMock.mockClear()
  })

  it("adesão com ciclo/valor incoerentes (padrão §3.1) → rejeita, faz rollback do usuário Supabase e não cria nada no repo", async () => {
    const createPaidManagerProfileMock = mock(async () => {
      throw new Error("createPaidManagerProfile não deveria ter sido chamado")
    })
    const repo = {
      createPaidManagerProfile: createPaidManagerProfileMock,
    } as unknown as IBackofficeAdhesionRepository
    const service = new BackofficeAdhesionService(repo)

    // Mesmo padrão do Jean Cristian na §3.1: MONTHLY com total de 3 meses.
    const adhesion = buildAdhesion({
      cycle: "monthly",
      monthlyTotalAmount: 91.4 as unknown as BackofficeAdhesionWithRelations["monthlyTotalAmount"],
      totalAmount: 274.2 as unknown as BackofficeAdhesionWithRelations["totalAmount"],
    })

    await expect((service as any).ensureAccountForPaidAdhesion(adhesion)).rejects.toThrow(
      /guard de assinatura/,
    )

    expect(createPaidManagerProfileMock).not.toHaveBeenCalled()
    expect(deleteUserMock).toHaveBeenCalledWith("auth-user-1")
  })

  it("adesão coerente (274,20/QUARTERLY) → guard não bloqueia, fluxo segue além do guard", async () => {
    const createPaidManagerProfileMock = mock(async () => {
      // Interrompe o teste logo após o guard passar — não precisamos exercitar
      // o resto do fluxo de provisionamento aqui (fora do escopo do guard).
      throw new Error("sentinel: passou do guard")
    })
    const repo = {
      createPaidManagerProfile: createPaidManagerProfileMock,
    } as unknown as IBackofficeAdhesionRepository
    const service = new BackofficeAdhesionService(repo)

    const adhesion = buildAdhesion({
      cycle: "quarterly",
      monthlyTotalAmount: 91.4 as unknown as BackofficeAdhesionWithRelations["monthlyTotalAmount"],
      totalAmount: 274.2 as unknown as BackofficeAdhesionWithRelations["totalAmount"],
    })

    await expect((service as any).ensureAccountForPaidAdhesion(adhesion)).rejects.toThrow(
      /sentinel: passou do guard/,
    )

    expect(createPaidManagerProfileMock).toHaveBeenCalledTimes(1)
  })
})
