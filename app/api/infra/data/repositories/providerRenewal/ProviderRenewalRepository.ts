import { prisma } from "@/app/api/infra/data/prisma";

export type RouterSubscriptionDue = { readonly profileId: string; readonly dueDate: Date };

export type LegacyAsaasSubscription = { readonly asaasSubscriptionId: string; readonly account: "primary" | "legacy" };

export class ProviderRenewalRepository {
  /** Assinatura recorrente que a conta ainda tem no Asaas (`provider` nulo). */
  async findLegacyAsaasSubscription(profileId: string): Promise<LegacyAsaasSubscription | null> {
    const row = await prisma.profileSubscription.findFirst({
      where: { profileId, provider: null, asaasSubscriptionId: { not: null } },
      select: { asaasSubscriptionId: true, asaasSubscriptionAccount: true },
    });
    if (!row?.asaasSubscriptionId) return null;
    return { asaasSubscriptionId: row.asaasSubscriptionId, account: row.asaasSubscriptionAccount };
  }

  /**
   * Assinaturas ativas do roteador (`provider` preenchido, ou seja, sem o Asaas para avisar o
   * atraso) com vencimento na janela. Ordem estável por `profileId` para o cursor paginar.
   */
  async listActiveRouterSubscriptionsDueBetween(input: {
    dueSince: Date;
    dueUntil: Date;
    limit: number;
    afterProfileId?: string;
  }): Promise<RouterSubscriptionDue[]> {
    const rows = await prisma.profileSubscription.findMany({
      where: {
        subscriptionStatus: "active",
        hasPermanentSubscription: false,
        provider: { not: null },
        subscriptionNextDueDate: { gte: input.dueSince, lte: input.dueUntil },
        ...(input.afterProfileId ? { profileId: { gt: input.afterProfileId } } : {}),
      },
      select: { profileId: true, subscriptionNextDueDate: true },
      orderBy: { profileId: "asc" },
      take: input.limit,
    });
    return rows.flatMap((row) =>
      row.subscriptionNextDueDate ? [{ profileId: row.profileId, dueDate: row.subscriptionNextDueDate }] : [],
    );
  }

  /**
   * Passa a conta de `active` para `past_due`, só se ela continua ativa com o mesmo vencimento
   * (um pagamento que avançou o vencimento no meio do caminho não é revertido). Devolve se mudou.
   */
  async markPastDueIfStillDue(profileId: string, dueDate: Date): Promise<boolean> {
    return prisma.$transaction(async (transaction) => {
      const updated = await transaction.profileSubscription.updateMany({
        where: { profileId, subscriptionStatus: "active", subscriptionNextDueDate: dueDate },
        data: { subscriptionStatus: "past_due" },
      });
      if (updated.count === 0) return false;
      await transaction.profile.updateMany({
        where: { id: profileId, subscriptionStatus: "active" },
        data: { subscriptionStatus: "past_due" },
      });
      return true;
    });
  }

  /** Marca a assinatura legada como do roteador. Só atua sobre linha ainda sem provedor (idempotente). */
  async markOnRouter(profileId: string, provider: string): Promise<void> {
    await prisma.profileSubscription.updateMany({ where: { profileId, provider: null }, data: { provider } });
  }
}

export const providerRenewalRepository = new ProviderRenewalRepository();
