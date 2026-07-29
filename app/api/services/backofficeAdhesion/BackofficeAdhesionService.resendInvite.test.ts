import { describe, expect, it } from "bun:test"
import { BackofficeAdhesionService } from "./BackofficeAdhesionService"
import type {
  BackofficeAdhesionWithRelations,
  IBackofficeAdhesionRepository,
} from "@/app/api/infra/data/repositories/backoffice/backofficeAdhesion/IBackofficeAdhesionRepository"

function buildAdhesion(
  overrides: Partial<BackofficeAdhesionWithRelations>
): BackofficeAdhesionWithRelations {
  return {
    id: "adhesion-1",
    leadId: "lead-1",
    fullName: "William Santos Cruz",
    phone: "11999999999",
    email: "meu@universo.top",
    status: "pending",
    createdProfileId: null,
    createdSupabaseId: null,
    installmentLedger: [],
    lead: {
      id: "lead-1",
      name: "William Santos Cruz",
      email: "meu@universo.top",
      phone: "11999999999",
      cpfCnpj: null,
      status: "new_adhesion",
      sdrBackofficeUserId: null,
      closerBackofficeUserId: null,
    },
    sdrBackofficeUser: null,
    closerBackofficeUser: null,
    ...overrides,
  } as BackofficeAdhesionWithRelations
}

describe("BackofficeAdhesionService.resendInvite", () => {
  it("permite reenvio quando pending com conta provisionada", async () => {
    const state = { inviteMode: null as "invite" | "recovery" | null }
    const repo = {
      findById: async () =>
        buildAdhesion({
          createdProfileId: "profile-1",
          createdSupabaseId: "supabase-1",
          installmentLedger: [
            {
              index: 0,
              amount: 1200,
              status: "paid",
              paymentSource: "EXTERNAL",
              asaasPaymentId: null,
              paidAt: "2026-07-28T22:40:17.000Z",
            },
          ],
        }),
    } as unknown as IBackofficeAdhesionRepository

    const service = new BackofficeAdhesionService(repo)
    ;(
      service as unknown as {
        sendSetPasswordEmail: (
          adhesion: BackofficeAdhesionWithRelations,
          mode: "invite" | "recovery"
        ) => Promise<void>
      }
    ).sendSetPasswordEmail = async (_adhesion, mode) => {
      state.inviteMode = mode
    }

    const result = await service.resendInvite("adhesion-1")
    expect(result.email).toBe("meu@universo.top")
    expect(state.inviteMode).toBe("recovery")
  })

  it("bloqueia reenvio para adesão checkout sem conta e sem parcela externa paga", async () => {
    const repo = {
      findById: async () =>
        buildAdhesion({
          status: "pending",
          installmentLedger: [
            { index: 0, amount: 990, status: "pending", paymentSource: "ASAAS", asaasPaymentId: "pay_1" },
          ],
        }),
    } as unknown as IBackofficeAdhesionRepository

    const service = new BackofficeAdhesionService(repo)

    await expect(service.resendInvite("adhesion-1")).rejects.toThrow(
      "Convite disponível apenas após ativação da conta ou pagamento externo"
    )
  })
})
