import { prisma } from "@/app/api/infra/data/prisma";
import type { Prisma } from "@prisma/client";

export type PastDueSubscriptionRow = {
  profileId: string;
  asaasSubscriptionId: string | null;
  subscriptionStartDate: Date | null;
  updatedAt: Date;
  profile: {
    email: string;
    fullName: string | null;
    supabaseId: string | null;
    timezone: string;
  };
};

export type PastDueSubscriptionForDunningRow = {
  profileId: string;
  asaasSubscriptionId: string | null;
  subscriptionStartDate: Date | null;
  subscriptionNextDueDate: Date | null;
  profile: {
    email: string;
    fullName: string | null;
    supabaseId: string | null;
    timezone: string;
    subscriptionNextDueDate: Date | null;
  };
};

class BillingEngineRepository {
  async findPastDueSubscriptions(params: {
    windowStart: Date;
    take: number;
  }): Promise<PastDueSubscriptionRow[]> {
    return prisma.profileSubscription.findMany({
      where: {
        subscriptionStatus: "past_due",
        hasPermanentSubscription: false,
        updatedAt: { lte: new Date(), gte: params.windowStart },
      },
      select: {
        profileId: true,
        asaasSubscriptionId: true,
        subscriptionStartDate: true,
        updatedAt: true,
        profile: {
          select: { email: true, fullName: true, supabaseId: true, timezone: true },
        },
      },
      take: params.take,
    });
  }

  /**
   * 20 — Assinaturas — Backend E9 (Fase 4, T-20.28). Ao contrário de
   * `findPastDueSubscriptions` (filtra por `updatedAt`, que ignora quem está
   * em atraso há mais de PAST_DUE_INACTIVE_AFTER_DAYS — o bug citado na
   * SPEC), esta só traz quem já passou da janela de tolerância (`notBefore`
   * = hoje − 5 dias) e ordena pelo mais atrasado. Sem esse filtro + ORDER BY,
   * `take` era gasto em contas ainda em D0–D4 e o Postgres podia devolver
   * sempre o mesmo recorte, deixando contas em D5+/D15+ permanentemente sem
   * aviso (achado cursor/codex no PR #1198). O degrau exato
   * (crm_only/cut_off) continua resolvido em memória por
   * `resolveDelinquencyTier`, sobre a data efetiva.
   */
  async findPastDueSubscriptionsForDunning(params: {
    take: number;
    notBefore: Date;
  }): Promise<PastDueSubscriptionForDunningRow[]> {
    return prisma.profileSubscription.findMany({
      where: {
        subscriptionStatus: "past_due",
        hasPermanentSubscription: false,
        // A data efetiva pode vir da ProfileSubscription OU do Profile (o
        // webhook do Asaas grava só no Profile) — ver
        // `resolveEffectiveNextDueDate`.
        OR: [
          { subscriptionNextDueDate: { lte: params.notBefore } },
          {
            subscriptionNextDueDate: null,
            profile: { subscriptionNextDueDate: { lte: params.notBefore } },
          },
        ],
      },
      select: {
        profileId: true,
        asaasSubscriptionId: true,
        subscriptionStartDate: true,
        subscriptionNextDueDate: true,
        profile: {
          select: {
            email: true,
            fullName: true,
            supabaseId: true,
            timezone: true,
            subscriptionNextDueDate: true,
          },
        },
      },
      orderBy: { subscriptionNextDueDate: "asc" },
      take: params.take,
    });
  }

  /**
   * Dedupe do lembrete de inadimplência (T-20.28): já existe um aviso deste
   * degrau na timeline (SubscriptionChangeLog, append-only) desde o
   * vencimento atual? Filtra por `changeType` além do `eventType` porque
   * `reduced`/`cut` também são gravados pelo `PaymentValidationService` em
   * transições suspended/canceled (`lifecycleEventFromSubscriptionStatus`) —
   * sem o `changeType` um ciclo de atraso posterior pularia o e-mail
   * obrigatório (achado codex P2 no PR #1198).
   */
  async hasDelinquencyNoticeSince(params: {
    profileId: string;
    eventType: "reduced" | "cut";
    changeType: string;
    since: Date;
  }): Promise<boolean> {
    const found = await prisma.subscriptionChangeLog.findFirst({
      where: {
        profileId: params.profileId,
        eventType: params.eventType,
        changeType: params.changeType,
        createdAt: { gte: params.since },
      },
      select: { id: true },
    });
    return found !== null;
  }

  /**
   * Marca de dedupe do lembrete. Diferente de `logSubscriptionChange`, que
   * engole o erro num `catch` e só faz `console.error`: aqui a falha
   * **propaga**, senão o e-mail sai, a marca não é gravada e o cron reenvia
   * o mesmo aviso todo dia depois da janela de idempotência de 24h do
   * provedor (achado codex P2 no PR #1198).
   */
  async recordDelinquencyNotice(input: {
    profileId: string;
    eventType: "reduced" | "cut";
    changeType: string;
    source: string;
    metadata: Prisma.InputJsonValue;
  }): Promise<void> {
    await prisma.subscriptionChangeLog.create({
      data: {
        profile: { connect: { id: input.profileId } },
        source: input.source,
        changeType: input.changeType,
        eventType: input.eventType,
        metadata: input.metadata,
      },
    });
  }

  async findProfileSubscriptionForPastDue(profileId: string) {
    return prisma.profileSubscription.findUnique({
      where: { profileId },
      select: {
        subscriptionStatus: true,
        updatedAt: true,
        asaasSubscriptionId: true,
      },
    });
  }

  async findProfileBillingDates(profileId: string) {
    return prisma.profile.findUnique({
      where: { id: profileId },
      select: { subscriptionStatus: true, updatedAt: true },
    });
  }

  async findAdhesionDiscount(adhesionId: string) {
    return prisma.backofficeAdhesion.findUnique({
      where: { id: adhesionId },
      select: {
        id: true,
        discountPercent: true,
        discountStatus: true,
        totalAmount: true,
        negotiatedTotalAmount: true,
      },
    });
  }

  async updateAdhesionDiscount(
    adhesionId: string,
    // Aceita as duas formas, como o próprio prisma.update: `discountApprovedByProfileId`
    // é FK de relação (discountApprovedBy), então só existe na variante Unchecked.
    data:
      | Prisma.BackofficeAdhesionUpdateInput
      | Prisma.BackofficeAdhesionUncheckedUpdateInput
  ) {
    return prisma.backofficeAdhesion.update({
      where: { id: adhesionId },
      data,
    });
  }

  async findProfileForTransition(profileId: string) {
    return prisma.profile.findUnique({
      where: { id: profileId },
      select: {
        id: true,
        asaasSubscriptionId: true,
        subscriptionId: true,
        subscription: { select: { id: true, asaasSubscriptionId: true, productId: true } },
        userTypeAssignment: {
          select: { userType: { select: { slug: true } } },
        },
      },
    });
  }

  async findUserTypeBySlug(slug: string) {
    return prisma.profileUserType.findFirst({
      where: { slug },
      select: { id: true },
    });
  }

  async upsertUserTypeAssignment(params: {
    profileId: string;
    userTypeId: string;
    assignedByProfileId: string;
  }) {
    return prisma.profileUserTypeAssignment.upsert({
      where: { profileId: params.profileId },
      create: {
        profileId: params.profileId,
        userTypeId: params.userTypeId,
        assignedByProfileId: params.assignedByProfileId,
      },
      update: {
        userTypeId: params.userTypeId,
        assignedByProfileId: params.assignedByProfileId,
      },
    });
  }

  async findProductsByFeatureSlugs(slugs: string[]) {
    return prisma.backofficeProduct.findMany({
      where: {
        isActive: true,
        OR: slugs.map((slug) => ({ featureSlugs: { has: slug } })),
      },
      select: { id: true, featureSlugs: true },
    });
  }

  async upsertUserProductSubscription(params: {
    profileId: string;
    productId: string;
  }) {
    return prisma.backofficeUserSubscription.upsert({
      where: {
        profileId_productId: {
          profileId: params.profileId,
          productId: params.productId,
        },
      },
      create: {
        profileId: params.profileId,
        productId: params.productId,
        status: "active",
        startDate: new Date(),
      },
      update: { status: "active" },
    });
  }

  async upsertProfileSubscriptionProduct(params: {
    profileId: string;
    productId: string;
  }) {
    return prisma.profileSubscription.upsert({
      where: { profileId: params.profileId },
      create: {
        profileId: params.profileId,
        productId: params.productId,
        subscriptionStatus: "active",
      },
      update: { productId: params.productId },
    });
  }

  async createChangeLog(data: Prisma.SubscriptionChangeLogCreateInput) {
    return prisma.subscriptionChangeLog.create({ data });
  }

  async runInTransaction<T>(fn: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
    return prisma.$transaction(fn);
  }
}

export const billingEngineRepository = new BillingEngineRepository();
