import { describe, expect, it } from "bun:test"
import { BackofficeAdhesionUseCase } from "./BackofficeAdhesionUseCase"
import type { IBackofficeAdhesionService } from "@/app/api/services/backofficeAdhesion/IBackofficeAdhesionService"
import type { IBackofficeSponsorAuthorizationService } from "@/app/api/services/backofficeSponsorAuthorization/IBackofficeSponsorAuthorizationService"

describe("BackofficeAdhesionUseCase.create", () => {
  it("rejeita adesão guest com patrocinador não autorizado antes de criar", async () => {
    let created = false
    const service = {
      create: async () => {
        created = true
        throw new Error("should not create")
      },
    } as unknown as IBackofficeAdhesionService

    const sponsorAuthorization: IBackofficeSponsorAuthorizationService = {
      assertAuthorizedSponsor: async () => ({
        isAuthorized: false,
        reason: "not_authorized",
        errorMessage: "Patrocinador não autorizado",
      }),
      listAuthorizedSponsors: async () => [],
      listAllWithCounts: async () => [],
      grant: async () => ({ error: "not implemented" }),
      revoke: async () => ({ error: "not implemented" }),
      countSponsoredAccounts: async () => 0,
      listEligibleMasters: async () => [],
    }

    const useCase = new BackofficeAdhesionUseCase(service, sponsorAuthorization)
    const output = await useCase.create(
      {
        leadId: "lead-1",
        userType: "guest",
        sponsorMasterId: "bad-sponsor",
        cycle: "monthly",
        billingType: "EXTERNAL",
        email: "guest@example.com",
        fullName: "Guest User",
        phone: "11999999999",
        cpfCnpj: "12345678901",
        extraUsers: 0,
        extraTeams: 0,
      },
      "bo-user-1"
    )

    expect(output.isValid).toBe(false)
    expect(output.errorMessages).toContain("Patrocinador não autorizado")
    expect(created).toBe(false)
  })
})

/**
 * `BackofficeAdhesionsRequestError` (client) estende `ApiRequestError`, então
 * `toUserToastMessage` repassa `Output.errorMessages[0]` ao toast sem passar pelo
 * filtro de sinal técnico. Se o UseCase colocasse `error.message` cru em
 * `errorMessages` para uma falha inesperada (Prisma, Supabase Admin, SDK do Asaas),
 * esse detalhe interno vazaria verbatim para o usuário do backoffice — achado P2 do
 * PR #1203 (thread PRRT_kwDOPrEc6s6jyVkp, "Keep untrusted backend errors out of user
 * toasts"). Os testes abaixo travam a defesa: erro fora do allowlist de
 * `KNOWN_SAFE_ADHESION_ERROR_MESSAGES` é substituído pelo fallback genérico do
 * método; erro de negócio conhecido continua chegando intacto.
 */
describe("BackofficeAdhesionUseCase — sanitiza erro inesperado antes de expor no toast", () => {
  it("update: erro inesperado (ex.: driver do banco) não chega cru em errorMessages", async () => {
    const service = {
      update: async () => {
        throw new Error("Unique constraint failed on the fields: (`email`)")
      },
    } as unknown as IBackofficeAdhesionService

    const useCase = new BackofficeAdhesionUseCase(service)
    const output = await useCase.update("adh-1", {})

    expect(output.isValid).toBe(false)
    expect(output.errorMessages).toEqual(["Erro ao atualizar adesão"])
    expect(output.errorMessages.join(" ")).not.toContain("Unique constraint")
  })

  it("update: mensagem de negócio conhecida (adesão paga) chega intacta ao toast", async () => {
    const service = {
      update: async () => {
        throw new Error("Adesões pagas não podem ser editadas")
      },
    } as unknown as IBackofficeAdhesionService

    const useCase = new BackofficeAdhesionUseCase(service)
    const output = await useCase.update("adh-1", {})

    expect(output.isValid).toBe(false)
    expect(output.errorMessages).toEqual(["Adesões pagas não podem ser editadas"])
  })

  it("resend: erro inesperado (ex.: timeout do Asaas) não chega cru em errorMessages", async () => {
    const service = {
      resend: async () => {
        throw new Error("connect ETIMEDOUT 203.0.113.10:443")
      },
    } as unknown as IBackofficeAdhesionService

    const useCase = new BackofficeAdhesionUseCase(service)
    const output = await useCase.resend("adh-1")

    expect(output.isValid).toBe(false)
    expect(output.errorMessages).toEqual(["Erro ao reenviar adesão"])
  })

  it("resend: mensagem de negócio conhecida (assinatura já ativada) chega intacta ao toast", async () => {
    const service = {
      resend: async () => {
        throw new Error("Adesões pagas não podem ser reenviadas")
      },
    } as unknown as IBackofficeAdhesionService

    const useCase = new BackofficeAdhesionUseCase(service)
    const output = await useCase.resend("adh-1")

    expect(output.isValid).toBe(false)
    expect(output.errorMessages).toEqual(["Adesões pagas não podem ser reenviadas"])
  })

  it("getPublicUrl: erro inesperado não chega cru em errorMessages", async () => {
    const service = {
      getPublicUrl: async () => {
        throw new Error("TypeError: Cannot read properties of undefined (reading 'tokenPlain')")
      },
    } as unknown as IBackofficeAdhesionService

    const useCase = new BackofficeAdhesionUseCase(service)
    const output = await useCase.getPublicUrl("adh-1")

    expect(output.isValid).toBe(false)
    expect(output.errorMessages).toEqual(["Erro ao copiar link"])
  })

  it("getPendingInvoiceUrls: mensagem de negócio conhecida chega intacta ao toast", async () => {
    const service = {
      getPendingInvoiceUrls: async () => {
        throw new Error("Não há parcelas pendentes para cobrança")
      },
    } as unknown as IBackofficeAdhesionService

    const useCase = new BackofficeAdhesionUseCase(service)
    const output = await useCase.getPendingInvoiceUrls("adh-1")

    expect(output.isValid).toBe(false)
    expect(output.errorMessages).toEqual(["Não há parcelas pendentes para cobrança"])
  })
})
