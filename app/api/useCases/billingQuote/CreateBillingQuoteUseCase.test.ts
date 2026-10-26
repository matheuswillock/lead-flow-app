import { describe, expect, it, mock } from "bun:test"
import type { BillingQuoteProjection } from "@/app/api/infra/data/repositories/billingQuote/IBillingQuoteRepository"
import { BillingQuoteService } from "@/app/api/services/billingQuote/BillingQuoteService"
import { CreateBillingQuoteUseCase } from "./CreateBillingQuoteUseCase"

const projection: BillingQuoteProjection = {
  billingOwnerId: "owner-1",
  billingCycle: "monthly",
  baseProduct: { productId: "base", slug: "crm", name: "CRM", unitAmount: 59.9 },
  extraUserProduct: null,
  extraTeamProduct: null,
  billableActiveMembers: 1,
  activeTeams: 1,
  includedExtraUsers: 0,
  includedExtraTeams: 0,
  manualAdjustmentExtraUsers: 0,
  manualAdjustmentExtraTeams: 0,
  hasPermanentSubscription: false,
  hasUnlimitedUsers: false,
  asaasSubscriptionId: "sub_1",
  asaasSubscriptionAccount: "legacy",
}

describe("CreateBillingQuoteUseCase", () => {
  it("compara a projeção com a assinatura da conta Asaas indicada pelo ponteiro", async () => {
    const getProjection = mock(async () => projection)
    const getSubscription = mock(async () => ({ value: 59.9 }))
    const useCase = new CreateBillingQuoteUseCase({
      repository: { getProjection } as never,
      asaasSubscriptionService: { getSubscription } as never,
      quoteService: new BillingQuoteService(),
    })

    const output = await useCase.execute("owner-1")

    expect(getSubscription).toHaveBeenCalledWith("sub_1", "legacy")
    expect(output.isValid).toBe(true)
    expect(output.result.status).toBe("aligned")
  })

  it("bloqueia a projeção quando a assinatura não possui ponteiro Asaas", async () => {
    const getProjection = mock(async () => ({
      ...projection,
      asaasSubscriptionId: null,
      asaasSubscriptionAccount: null,
    }))
    const getSubscription = mock(async () => ({ value: 59.9 }))
    const useCase = new CreateBillingQuoteUseCase({
      repository: { getProjection } as never,
      asaasSubscriptionService: { getSubscription } as never,
      quoteService: new BillingQuoteService(),
    })

    const output = await useCase.execute("owner-1")

    expect(getSubscription).not.toHaveBeenCalled()
    expect(output.result.status).toBe("blocked")
    expect(output.result.blockingReasons).toContain("Ponteiro de assinatura Asaas ausente")
  })

  it("não calcula a projeção para membro que não é master", async () => {
    const getProjection = mock(async () => projection)
    const getAccessBySupabaseId = mock(async () => ({
      billingOwnerId: "owner-1",
      isMaster: false,
      isBanned: false,
    }))
    const useCase = new CreateBillingQuoteUseCase({
      repository: { getProjection, getAccessBySupabaseId } as never,
      asaasSubscriptionService: { getSubscription: mock(async () => ({ value: 59.9 })) } as never,
      quoteService: new BillingQuoteService(),
    })

    const output = await useCase.executeForAuthenticatedSupabaseId("member-supabase-id")

    expect(output.isValid).toBe(false)
    expect(output.errorMessages).toEqual(["Apenas o master pode visualizar a projeção de cobrança"])
    expect(getProjection).not.toHaveBeenCalled()
  })

  it("não calcula a projeção para master banido", async () => {
    const getProjection = mock(async () => projection)
    const getAccessBySupabaseId = mock(async () => ({
      billingOwnerId: "owner-1",
      isMaster: true,
      isBanned: true,
    }))
    const useCase = new CreateBillingQuoteUseCase({
      repository: { getProjection, getAccessBySupabaseId } as never,
      asaasSubscriptionService: { getSubscription: mock(async () => ({ value: 59.9 })) } as never,
      quoteService: new BillingQuoteService(),
    })

    const output = await useCase.executeForAuthenticatedSupabaseId("master-supabase-id")

    expect(output.isValid).toBe(false)
    expect(output.errorMessages).toEqual(["Esta conta está bloqueada"])
    expect(getProjection).not.toHaveBeenCalled()
  })
})
