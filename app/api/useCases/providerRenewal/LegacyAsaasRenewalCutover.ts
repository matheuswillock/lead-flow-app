export type LegacyAsaasRenewalCutoverDeps = {
  /** Kill switch: desligado, o corte não toca o Asaas nem a conta. */
  readonly isEnabled: () => boolean;
  readonly findLegacySubscription: (
    profileId: string,
  ) => Promise<{ asaasSubscriptionId: string; account: "primary" | "legacy" } | null>;
  readonly cancelAsaasSubscription: (subscriptionId: string, account: "primary" | "legacy") => Promise<unknown>;
  readonly markOnRouter: (profileId: string, provider: string) => Promise<void>;
};

/** Assinatura que o Asaas já não conhece (cancelada antes): o corte pode seguir. */
function isAlreadyGone(error: unknown): boolean {
  return error instanceof Error && /404|not found|não encontrad/i.test(error.message);
}

/**
 * Corte legado (Asaas): quando a renovação de uma conta que ainda tem assinatura recorrente no
 * Asaas é paga pelo roteador, cancela a assinatura no Asaas (evita cobrança em duplicidade no
 * próximo ciclo) e só então marca a conta com o provedor que recebeu o pagamento. A ordem deixa o
 * corte retomável: se a marcação falhar, a próxima chamada cancela de novo (o Asaas já não a
 * conhece) e marca.
 */
export class LegacyAsaasRenewalCutover {
  constructor(private readonly deps: LegacyAsaasRenewalCutoverDeps) {}

  async cutOver(profileId: string, provider: string): Promise<void> {
    if (!this.deps.isEnabled()) return;
    const legacy = await this.deps.findLegacySubscription(profileId);
    if (!legacy) return;

    try {
      await this.deps.cancelAsaasSubscription(legacy.asaasSubscriptionId, legacy.account);
    } catch (error) {
      if (!isAlreadyGone(error)) throw error;
    }
    await this.deps.markOnRouter(profileId, provider);
  }
}
