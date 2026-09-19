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

  /**
   * Regressão apontada pela revisão do cursor[bot] na 1ª versão deste fix: o
   * allowlist inicial só cobria as mensagens literais já existentes em
   * `EXPECTED_CREATE_ERROR_MESSAGES` e não incluía toda a copy de validação que
   * `BackofficeAdhesionService.create`/`update` ainda lançam de propósito — o
   * operador perdia o motivo acionável (e-mail do guest, CPF/CNPJ, produto/ciclo)
   * e via só o fallback genérico.
   */
  it("create: e-mail obrigatório para conta Convidado chega intacta ao toast", async () => {
    const service = {
      create: async () => {
        throw new Error("E-mail é obrigatório para conta Convidado")
      },
    } as unknown as IBackofficeAdhesionService

    const useCase = new BackofficeAdhesionUseCase(service)
    // userType "common" evita o early-return de patrocinador do UseCase (guest/
    // associate) — o objetivo aqui é isolar a sanitização de `service.create`,
    // não reproduzir a regra de negócio completa de conta convidado.
    const output = await useCase.create(
      { leadId: "lead-1", userType: "common", cycle: "monthly", extraTeams: 0, extraUsers: 0, fullName: "Guest" },
      null
    )

    expect(output.isValid).toBe(false)
    expect(output.errorMessages).toEqual(["E-mail é obrigatório para conta Convidado"])
  })

  it("update: CPF/CNPJ inválido para pagamento por fora chega intacta ao toast", async () => {
    const service = {
      update: async () => {
        throw new Error("CPF/CNPJ inválido para pagamento por fora")
      },
    } as unknown as IBackofficeAdhesionService

    const useCase = new BackofficeAdhesionUseCase(service)
    const output = await useCase.update("adh-1", {})

    expect(output.isValid).toBe(false)
    expect(output.errorMessages).toEqual(["CPF/CNPJ inválido para pagamento por fora"])
  })

  it("create: produto obrigatório indisponível (mensagem template) chega intacta ao toast", async () => {
    const service = {
      create: async () => {
        throw new Error("Produto obrigatório indisponível: crm")
      },
    } as unknown as IBackofficeAdhesionService

    const useCase = new BackofficeAdhesionUseCase(service)
    const output = await useCase.create(
      { leadId: "lead-1", cycle: "monthly", extraTeams: 0, extraUsers: 0, fullName: "Lead" },
      null
    )

    expect(output.isValid).toBe(false)
    expect(output.errorMessages).toEqual(["Produto obrigatório indisponível: crm"])
  })

  it("update: ciclo indisponível na precificação (mensagem template) chega intacta ao toast", async () => {
    const service = {
      update: async () => {
        throw new Error("O ciclo quarterly não está disponível na precificação selecionada")
      },
    } as unknown as IBackofficeAdhesionService

    const useCase = new BackofficeAdhesionUseCase(service)
    const output = await useCase.update("adh-1", {})

    expect(output.isValid).toBe(false)
    expect(output.errorMessages).toEqual([
      "O ciclo quarterly não está disponível na precificação selecionada",
    ])
  })
})
