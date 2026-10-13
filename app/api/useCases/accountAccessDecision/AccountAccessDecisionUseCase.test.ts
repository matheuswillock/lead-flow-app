import { describe, expect, it, mock } from "bun:test"
import { AccountAccessDecisionUseCase } from "./AccountAccessDecisionUseCase"

const repository = {
  resolveProfileId: async () => "owner-1",
  resolveAccount: async () => ({
    billingOwnerId: "owner-1",
    subscriptionStatus: "past_due" as const,
    hasPermanentSubscription: false,
    isBanned: false,
  }),
}

describe("AccountAccessDecisionUseCase", () => {
  it("bloqueia imediatamente uma assinatura past_due", async () => {
    const output = await new AccountAccessDecisionUseCase(repository).execute({
      profileId: "member-1",
    })

    expect(output.isValid).toBe(true)
    expect(output.result).toEqual({ state: "restricted", reason: "past_due", isBillingOwner: false })
  })

  it("não expõe regularização por cartão durante o bloqueio", async () => {
    const output = await new AccountAccessDecisionUseCase({
      resolveProfileId: async () => "owner-1",
      resolveAccount: async () => ({
        billingOwnerId: "owner-1",
        subscriptionStatus: "past_due",
        hasPermanentSubscription: false,
        isBanned: false,
      }),
    }).execute({ profileId: "owner-1" })

    expect(output.result).toEqual({ state: "restricted", reason: "past_due", isBillingOwner: true })
  })

  it("prioriza banimento mesmo para assinatura permanente", async () => {
    const bannedRepository = {
      resolveProfileId: async () => "owner-1",
      resolveAccount: async () => ({
        billingOwnerId: "owner-1",
        subscriptionStatus: "active" as const,
        hasPermanentSubscription: true,
        isBanned: true,
      }),
    }

    const output = await new AccountAccessDecisionUseCase(bannedRepository).execute({
      profileId: "owner-1",
    })

    expect(output.result).toEqual({ state: "restricted", reason: "banned", isBillingOwner: true })
  })

  it("não usa o status legado quando existe assinatura moderna sem status", async () => {
    const noStatusRepository = {
      resolveProfileId: async () => "owner-1",
      resolveAccount: async () => ({
        billingOwnerId: "owner-1",
        subscriptionStatus: null,
        hasPermanentSubscription: false,
        isBanned: false,
      }),
    }

    const output = await new AccountAccessDecisionUseCase(noStatusRepository).execute({
      profileId: "owner-1",
    })

    expect(output.result).toEqual({ state: "restricted", reason: "subscription_unavailable", isBillingOwner: true })
  })

  it("mantém o time solicitado na resolução do master da cobrança", async () => {
    const resolveAccount = mock(async (input: { profileId: string; teamId?: string | null }) => ({
      billingOwnerId: input.teamId === "sponsored-team" ? "sponsored-owner" : "profile-owner",
      subscriptionStatus: "active",
      hasPermanentSubscription: false,
      isBanned: false,
    }))
    const repositoryWithTeamOwner = {
      resolveProfileId: async () => "profile-1",
      resolveAccount,
    }

    const output = await new AccountAccessDecisionUseCase(repositoryWithTeamOwner).execute({
      profileId: "sponsor-profile",
      teamId: "sponsored-team",
    })

    expect(output.isValid).toBe(true)
    expect(resolveAccount).toHaveBeenCalledWith({
      profileId: "sponsor-profile",
      teamId: "sponsored-team",
    })
  })
})
