import { prisma } from "@/app/api/infra/data/prisma";
import { resolveEffectiveNextDueDate } from "@/lib/billing/delinquency-tier";

/** `dueDate` é o vencimento efetivo: o mais antigo entre a assinatura e o perfil (o acesso conta assim). */
export type RouterSubscriptionDue = { readonly profileId: string; readonly dueDate: Date };

export type LegacyAsaasSubscription = { readonly asaasSubscriptionId: string; readonly account: "primary" | "legacy" };

export class ProviderRenewalRepository {
  /**
   * Assinatura recorrente que a conta ainda tem no Asaas. O id pode estar só no perfil (o mesmo
   * fallback do sync do Asaas), então sai de lá quando a linha da assinatura não o tem. O par
   * (id, conta) vem sempre da mesma linha, com a assinatura vencendo o perfil. Conta já marcada
   * com provedor do roteador não tem mais assinatura a cancelar.
   */
  async findLegacyAsaasSubscription(profileId: string): Promise<LegacyAsaasSubscription | null> {
    const [subscription, profile] = await Promise.all([
      prisma.profileSubscription.findUnique({
        where: { profileId },
        select: { provider: true, asaasSubscriptionId: true, asaasSubscriptionAccount: true },
      }),
      prisma.profile.findUnique({
        where: { id: profileId },
        select: { asaasSubscriptionId: true, asaasSubscriptionAccount: true },
      }),
    ]);
    if (subscription?.provider) return null;
    if (subscription?.asaasSubscriptionId) {
      return { asaasSubscriptionId: subscription.asaasSubscriptionId, account: subscription.asaasSubscriptionAccount };
    }
    if (profile?.asaasSubscriptionId) {
      return { asaasSubscriptionId: profile.asaasSubscriptionId, account: profile.asaasSubscriptionAccount };
    }
    return null;
  }

  /**
   * Assinaturas ativas do roteador (`provider` preenchido, ou seja, sem o Asaas para avisar o
   * atraso) cujo vencimento efetivo cai na janela. O efetivo é o mais antigo entre assinatura e
   * perfil, então nenhuma das duas datas pode estar antes do início da janela e pelo menos uma
   * precisa já ter vencido. Ordem estável por `profileId` para o cursor paginar.
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
        AND: [
          { OR: [{ subscriptionNextDueDate: null }, { subscriptionNextDueDate: { gte: input.dueSince } }] },
          {
            OR: [
              { profile: { subscriptionNextDueDate: null } },
              { profile: { subscriptionNextDueDate: { gte: input.dueSince } } },
            ],
          },
          {
            OR: [
              { subscriptionNextDueDate: { lte: input.dueUntil } },
              { profile: { subscriptionNextDueDate: { lte: input.dueUntil } } },
            ],
          },
        ],
        ...(input.afterProfileId ? { profileId: { gt: input.afterProfileId } } : {}),
      },
      select: {
        profileId: true,
        subscriptionNextDueDate: true,
        profile: { select: { subscriptionNextDueDate: true } },
      },
      orderBy: { profileId: "asc" },
      take: input.limit,
    });
    return rows.flatMap((row) => {
      const dueDate = resolveEffectiveNextDueDate(row.subscriptionNextDueDate, row.profile.subscriptionNextDueDate);
      return dueDate ? [{ profileId: row.profileId, dueDate }] : [];
    });
  }

  /**
   * Passa a conta de `active` para `past_due`, só se ela continua ativa com o mesmo vencimento
   * efetivo (um pagamento que avançou o vencimento no meio do caminho não é revertido). Devolve
   * se mudou.
   */
  async markPastDueIfStillDue(profileId: string, dueDate: Date): Promise<boolean> {
    return prisma.$transaction(async (transaction) => {
      const [subscription, profile] = await Promise.all([
        transaction.profileSubscription.findUnique({
          where: { profileId },
          select: { subscriptionStatus: true, subscriptionNextDueDate: true },
        }),
        transaction.profile.findUnique({ where: { id: profileId }, select: { subscriptionNextDueDate: true } }),
      ]);
      if (!subscription || subscription.subscriptionStatus !== "active") return false;
      const effective = resolveEffectiveNextDueDate(subscription.subscriptionNextDueDate, profile?.subscriptionNextDueDate);
      if (!effective || effective.getTime() !== dueDate.getTime()) return false;

      // A condição repete a data lida: se um pagamento a mudou nesse intervalo, nada é atualizado.
      const updated = await transaction.profileSubscription.updateMany({
        where: { profileId, subscriptionStatus: "active", subscriptionNextDueDate: subscription.subscriptionNextDueDate },
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

  /**
   * Marca a conta legada como do roteador. Idempotente: só atua sobre linha ainda sem provedor.
   * Conta cujo id do Asaas está só no perfil não tem linha de assinatura; sem ela o sync do Asaas
   * continuaria consultando a assinatura cancelada. Então a linha nasce espelhando o perfil (status,
   * vencimento, prazo e o ponteiro do Asaas, que fica como auditoria), para a decisão de acesso
   * seguir lendo os mesmos valores.
   */
  async markOnRouter(profileId: string, provider: string): Promise<void> {
    await prisma.$transaction(async (transaction) => {
      const existing = await transaction.profileSubscription.findUnique({ where: { profileId }, select: { provider: true } });
      if (existing) {
        if (existing.provider === null) {
          await transaction.profileSubscription.updateMany({ where: { profileId, provider: null }, data: { provider } });
        }
        return;
      }
      const profile = await transaction.profile.findUnique({
        where: { id: profileId },
        select: {
          subscriptionStatus: true,
          subscriptionNextDueDate: true,
          subscriptionCycle: true,
          hasPermanentSubscription: true,
          asaasSubscriptionId: true,
          asaasSubscriptionAccount: true,
        },
      });
      if (!profile) return;
      await transaction.profileSubscription.create({
        data: {
          profileId,
          provider,
          subscriptionStatus: profile.subscriptionStatus,
          subscriptionNextDueDate: profile.subscriptionNextDueDate,
          subscriptionCycle: profile.subscriptionCycle,
          hasPermanentSubscription: profile.hasPermanentSubscription,
          asaasSubscriptionId: profile.asaasSubscriptionId,
          asaasSubscriptionAccount: profile.asaasSubscriptionAccount,
        },
      });
    });
  }
}

export const providerRenewalRepository = new ProviderRenewalRepository();
