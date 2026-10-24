import { describe, expect, it, mock } from "bun:test"
import { SubscriptionIdentityLinker } from "./SubscriptionIdentityLinker"

function makeLinker(subscription: { id: string; paymentCohort: string } | null) {
  const bind = mock(async (binding: unknown) => binding as never)
  const linker = new SubscriptionIdentityLinker({
    subscriptions: { findByProfileId: async () => subscription },
    identities: { bind },
  })
  return { linker, bind }
}

const input = {
  profileId: "profile-1",
  provider: "ABACATE_PAY" as const,
  environment: "PRODUCTION" as const,
  externalAccountContext: "abacate-production",
  externalId: "sub_ext_1",
}

describe("SubscriptionIdentityLinker", () => {
  it("grava a identidade SUBSCRIPTION da assinatura do router", async () => {
    const { linker, bind } = makeLinker({ id: "sub-1", paymentCohort: "ROUTER" })

    await linker.link(input)

    expect(bind).toHaveBeenCalledWith({
      provider: "ABACATE_PAY",
      environment: "PRODUCTION",
      externalAccountContext: "abacate-production",
      externalId: "sub_ext_1",
      identityType: "SUBSCRIPTION",
      ownerType: "PROFILE_SUBSCRIPTION",
      ownerId: "sub-1",
      tenantId: "profile-1",
      route: "NEW_ROUTER",
      routeVersion: "PAY-LEDGER-R1",
    })
  })

  it("recusa assinatura da coorte ASAAS (as colunas asaas* continuam sendo a fonte)", async () => {
    const { linker, bind } = makeLinker({ id: "sub-1", paymentCohort: "ASAAS" })

    await expect(linker.link(input)).rejects.toThrow("coorte ROUTER")
    expect(bind).not.toHaveBeenCalled()
  })

  it("recusa perfil sem assinatura", async () => {
    const { linker } = makeLinker(null)

    await expect(linker.link(input)).rejects.toThrow("Assinatura não encontrada")
  })
})
