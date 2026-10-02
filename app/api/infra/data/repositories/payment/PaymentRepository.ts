// app/api/infra/data/repositories/payment/PaymentRepository.ts

import { Profile, SubscriptionPlan, SubscriptionStatus } from '@prisma/client';
import type { AsaasAccountId } from '@/lib/asaas';
import { IPaymentRepository } from './IPaymentRepository';
import prisma from '../../prisma';

export class PaymentRepository implements IPaymentRepository {
  /**
   * Achado P1 da revisão do PR #1207 (thread PRRT_...fFct): `sub_` e `cus_`
   * são escopados por CONTA no Asaas — o mesmo id pode existir na legacy e
   * na primary apontando para clientes diferentes. Sem filtrar pela conta
   * do evento, o webhook podia resolver o profile da conta errada e marcar
   * como ativo quem não pagou. `account` é opcional só para não quebrar
   * chamadas antigas sem contexto de conta; quando informado, é filtro.
   */
  async findBySubscriptionId(
    subscriptionId: string,
    account?: AsaasAccountId
  ): Promise<Profile | null> {
    // Look in ProfileSubscription (new table) first
    const sub = await prisma.profileSubscription.findFirst({
      where: {
        asaasSubscriptionId: subscriptionId,
        ...(account ? { asaasSubscriptionAccount: account } : {}),
      },
      include: { profile: true },
    });
    if (sub) return sub.profile;
    // Legacy fallback for profiles that still have subscriptionId on the Profile row
    return prisma.profile.findFirst({
      where: {
        subscriptionId,
        ...(account ? { asaasSubscriptionAccount: account } : {}),
      },
    });
  }

  async findByAsaasCustomerId(
    asaasCustomerId: string,
    account?: AsaasAccountId
  ): Promise<Profile | null> {
    return prisma.profile.findFirst({
      where: {
        asaasCustomerId,
        // Mesmo motivo do método acima (thread PRRT_...fFct): este é o
        // FALLBACK do webhook, o caminho em que a colisão de `cus_` entre
        // contas escolhe o profile errado com mais facilidade.
        ...(account ? { asaasCustomerAccount: account } : {}),
      },
    });
  }

  async findByEmail(email: string): Promise<Profile | null> {
    return prisma.profile.findFirst({
      where: { email },
    });
  }

  async findById(id: string): Promise<Profile | null> {
    return prisma.profile.findFirst({ where: { id } });
  }

  async updateSubscriptionStatus(
    profileId: string,
    subscriptionStatus: string,
    subscriptionStartDate?: Date
  ): Promise<Profile> {
    const subData: any = { subscriptionStatus };
    if (subscriptionStartDate) subData.subscriptionStartDate = subscriptionStartDate;

    await prisma.profileSubscription.upsert({
      where: { profileId },
      create: { profileId, ...subData },
      update: subData,
    });

    // Keep Profile in sync for legacy compatibility
    const profileData: any = { subscriptionStatus };
    if (subscriptionStartDate) profileData.subscriptionStartDate = subscriptionStartDate;
    return prisma.profile.update({ where: { id: profileId }, data: profileData });
  }

  async updateSubscriptionData(
    profileId: string,
    data: {
      asaasCustomerId?: string;
      subscriptionId?: string;
      subscriptionAccount?: AsaasAccountId;
      subscriptionPlan?: string;
      subscriptionStatus?: string;
      subscriptionStartDate?: Date;
      subscriptionEndDate?: Date;
    }
  ): Promise<Profile> {
    // asaasCustomerId stays on Profile (customer identity, not subscription)
    if (data.asaasCustomerId !== undefined) {
      await prisma.profile.update({
        where: { id: profileId },
        data: { asaasCustomerId: data.asaasCustomerId },
      });
    }

    // Subscription fields go to ProfileSubscription
    const subData: any = {};
    if (data.subscriptionId !== undefined) subData.asaasSubscriptionId = data.subscriptionId;
    // Achado P1 da revisão do PR #1207 (thread PRRT_...YP_y): a conta anda
    // junto do id, nunca sozinha. Quando o caller só muda status
    // (PAYMENT_OVERDUE, refund) o ponteiro não é tocado e a conta também
    // não — rotular aqui sobrescreveria a conta correta por um default.
    if (data.subscriptionAccount !== undefined) {
      subData.asaasSubscriptionAccount = data.subscriptionAccount;
    }
    if (data.subscriptionPlan !== undefined) subData.subscriptionPlan = data.subscriptionPlan as SubscriptionPlan;
    if (data.subscriptionStatus !== undefined) subData.subscriptionStatus = data.subscriptionStatus as SubscriptionStatus;
    if (data.subscriptionStartDate !== undefined) subData.subscriptionStartDate = data.subscriptionStartDate;
    if (data.subscriptionEndDate !== undefined) subData.subscriptionEndDate = data.subscriptionEndDate;

    if (Object.keys(subData).length > 0) {
      await prisma.profileSubscription.upsert({
        where: { profileId },
        create: { profileId, ...subData },
        update: subData,
      });
    }

    // Achado P1 da revisão do PR #1207 (threads PRRT_...ZZPj e
    // PRRT_...aTIu): este método nunca grava `asaasSubscriptionId` no
    // Profile — só no ProfileSubscription. Copiar a conta pra lá quando o
    // ponteiro do Profile é OUTRA assinatura montaria um par inconsistente
    // `(id de uma, conta de outra)`, que é exatamente o que
    // `getSyncSnapshot` e o roteamento por conta consomem.
    //
    // O guard é um `updateMany` CONDICIONAL, não um read-then-write: entre
    // um `findUnique` e o `update` incondicional cabia um upgrade trocando
    // o `asaasSubscriptionId` do Profile, e a conta do webhook acabaria
    // colada na assinatura nova — recriando o par inconsistente por corrida.
    // Aqui a condição está no próprio `where`, avaliada pelo Postgres.
    if (data.subscriptionAccount !== undefined && data.subscriptionId !== undefined) {
      await prisma.profile.updateMany({
        where: { id: profileId, asaasSubscriptionId: data.subscriptionId },
        data: { asaasSubscriptionAccount: data.subscriptionAccount },
      });
    }

    // Keep Profile in sync for legacy compatibility
    const profileData: any = {};
    if (data.subscriptionPlan !== undefined) profileData.subscriptionPlan = data.subscriptionPlan as SubscriptionPlan;
    if (data.subscriptionStatus !== undefined) profileData.subscriptionStatus = data.subscriptionStatus as SubscriptionStatus;
    if (data.subscriptionStartDate !== undefined) profileData.subscriptionStartDate = data.subscriptionStartDate;
    if (data.subscriptionEndDate !== undefined) profileData.subscriptionEndDate = data.subscriptionEndDate;
    if (Object.keys(profileData).length > 0) {
      await prisma.profile.update({ where: { id: profileId }, data: profileData });
    }

    return prisma.profile.findUniqueOrThrow({ where: { id: profileId } });
  }
}
