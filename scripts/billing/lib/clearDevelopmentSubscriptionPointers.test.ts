import { describe, expect, it } from "bun:test"
import {
  planDevelopmentSubscriptionPointerCleanup,
  type DevelopmentSubscriptionProfile,
  type DevelopmentSubscriptionPointerTarget,
} from "./clearDevelopmentSubscriptionPointers"

const target: DevelopmentSubscriptionPointerTarget = {
  profileId: "profile-1",
  email: "dev@example.com",
  legacySubscriptionId: "sub_legacy",
}

const profile: DevelopmentSubscriptionProfile = {
  id: target.profileId,
  email: target.email,
  asaasCustomerId: "cus_primary",
  asaasCustomerAccount: "primary",
  asaasSubscriptionId: target.legacySubscriptionId,
  asaasSubscriptionAccount: "legacy",
  hasPermanentSubscription: true,
  subscription: {
    asaasSubscriptionId: target.legacySubscriptionId,
    asaasSubscriptionAccount: "legacy",
    hasPermanentSubscription: true,
  },
}

describe("planDevelopmentSubscriptionPointerCleanup", () => {
  it("libera somente o ponteiro legado com customer primary e assinatura permanente confirmados", () => {
    expect(planDevelopmentSubscriptionPointerCleanup({ targets: [target], profiles: [profile] })).toEqual([
      { target, action: "clear", reason: expect.any(String) },
    ])
  })

  it("bloqueia alvo com e-mail divergente", () => {
    expect(
      planDevelopmentSubscriptionPointerCleanup({
        targets: [{ ...target, email: "other@example.com" }],
        profiles: [profile],
      })[0].action
    ).toBe("blocked")
  })

  it("bloqueia alvo sem assinatura permanente", () => {
    expect(
      planDevelopmentSubscriptionPointerCleanup({
        targets: [target],
        profiles: [{ ...profile, hasPermanentSubscription: false }],
      })[0].action
    ).toBe("blocked")
  })

  it("bloqueia ponteiro que não corresponde exatamente ao legado autorizado", () => {
    expect(
      planDevelopmentSubscriptionPointerCleanup({
        targets: [target],
        profiles: [{ ...profile, asaasSubscriptionId: "sub_other" }],
      })[0].action
    ).toBe("blocked")
  })

  it("é idempotente depois que os ponteiros já foram limpos", () => {
    expect(
      planDevelopmentSubscriptionPointerCleanup({
        targets: [target],
        profiles: [
          {
            ...profile,
            asaasSubscriptionId: null,
            asaasSubscriptionAccount: "primary",
            subscription: {
              ...profile.subscription!,
              asaasSubscriptionId: null,
              asaasSubscriptionAccount: "primary",
            },
          },
        ],
      })[0].action
    ).toBe("already-cleared")
  })
})
