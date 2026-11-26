import { describe, expect, it } from "bun:test";
import { LegacyAsaasRenewalCutover, type LegacyAsaasRenewalCutoverDeps } from "./LegacyAsaasRenewalCutover";

function build(overrides: Partial<LegacyAsaasRenewalCutoverDeps> = {}) {
  const calls: string[] = [];
  const deps: LegacyAsaasRenewalCutoverDeps = {
    isEnabled: () => true,
    findLegacySubscription: async () => ({ asaasSubscriptionId: "sub_1", account: "primary" }),
    cancelAsaasSubscription: async (id, account) => {
      calls.push(`cancel:${id}:${account}`);
    },
    markOnRouter: async (profileId, provider) => {
      calls.push(`mark:${profileId}:${provider}`);
    },
    ...overrides,
  };
  return { cutover: new LegacyAsaasRenewalCutover(deps), calls };
}

describe("LegacyAsaasRenewalCutover", () => {
  it("cancela no Asaas e depois marca a conta com o provedor que recebeu o pagamento", async () => {
    const { cutover, calls } = build();

    await cutover.cutOver("profile-1", "ROUTED_KEY");

    expect(calls).toEqual(["cancel:sub_1:primary", "mark:profile-1:ROUTED_KEY"]);
  });

  it("kill switch desligado: não consulta, não cancela e não marca", async () => {
    const { cutover, calls } = build({
      isEnabled: () => false,
      findLegacySubscription: async () => {
        calls.push("find");
        return { asaasSubscriptionId: "sub_1", account: "primary" };
      },
    });

    await cutover.cutOver("profile-1", "ROUTED_KEY");

    expect(calls).toHaveLength(0);
  });

  it("não faz nada quando a conta já passou para o roteador", async () => {
    const { cutover, calls } = build({ findLegacySubscription: async () => null });

    await cutover.cutOver("profile-1", "ROUTED_KEY");

    expect(calls).toHaveLength(0);
  });

  it("assinatura já removida no Asaas não impede o corte", async () => {
    const { cutover, calls } = build({
      cancelAsaasSubscription: async () => {
        throw new Error("Asaas 404: not found");
      },
    });

    await cutover.cutOver("profile-1", "ROUTED_KEY");

    expect(calls).toEqual(["mark:profile-1:ROUTED_KEY"]);
  });

  it("falha real do Asaas propaga e não marca a conta", async () => {
    const { cutover, calls } = build({
      cancelAsaasSubscription: async () => {
        throw new Error("Asaas 500");
      },
    });

    await expect(cutover.cutOver("profile-1", "ROUTED_KEY")).rejects.toThrow("Asaas 500");
    expect(calls).toHaveLength(0);
  });
});
