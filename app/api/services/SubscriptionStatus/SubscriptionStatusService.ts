// app/api/services/SubscriptionStatus/SubscriptionStatusService.ts

import {
  ISubscriptionStatusService,
  SubscriptionStatusResult,
} from "./ISubscriptionStatusService";
import { prisma } from "../../infra/data/prisma";
import { asaasApi, asaasFetch } from '@/lib/asaas';
import { differenceInDaysInTz, isPastInTz, resolveTimezone } from "@/lib/dates";

export class SubscriptionStatusService implements ISubscriptionStatusService {

  async checkPaymentStatus(subscriptionId: string): Promise<SubscriptionStatusResult> {
    try {
      console.info('🔍 [SubscriptionStatusService] Buscando assinatura no banco...');

      // 1. Buscar via ProfileSubscription (fonte de verdade)
      const profileSub = await prisma.profileSubscription.findFirst({
        where: { asaasSubscriptionId: subscriptionId },
        select: {
          subscriptionStatus: true,
          subscriptionPlan: true,
          subscriptionStartDate: true,
          subscriptionEndDate: true,
          trialEndDate: true,
          profile: { select: { id: true, email: true, timezone: true } },
        },
      })

      const sub = profileSub ?? await (async () => {
        const legacy = await prisma.profile.findFirst({
          where: { subscriptionId },
          select: {
            id: true,
            email: true,
            timezone: true,
            subscriptionStatus: true,
            subscriptionPlan: true,
            subscriptionStartDate: true,
            subscriptionEndDate: true,
            trialEndDate: true,
          },
        })
        if (!legacy) return null
        return {
          subscriptionStatus: legacy.subscriptionStatus,
          subscriptionPlan: legacy.subscriptionPlan,
          subscriptionStartDate: legacy.subscriptionStartDate,
          subscriptionEndDate: legacy.subscriptionEndDate,
          trialEndDate: legacy.trialEndDate,
          profile: { id: legacy.id, email: legacy.email, timezone: legacy.timezone },
        }
      })()

      // 2. Se encontrou, retornar status do banco
      if (sub) {
        const isPaid = sub.subscriptionStatus === 'active';
        const timezone = resolveTimezone(sub.profile.timezone);
        let message = isPaid ? 'Assinatura ativa' : 'Assinatura pendente';

        if (sub.subscriptionStatus === 'trial' && sub.trialEndDate) {
          if (isPastInTz(sub.trialEndDate, timezone)) {
            message = 'Período de teste expirado';
          } else {
            const remainingDays = Math.max(
              0,
              differenceInDaysInTz(sub.trialEndDate, new Date(), timezone)
            );
            message =
              remainingDays > 0
                ? `Período de teste ativo (${remainingDays} dia(s) restantes)`
                : 'Período de teste ativo';
          }
        } else if (
          sub.subscriptionEndDate &&
          isPastInTz(sub.subscriptionEndDate, timezone) &&
          sub.subscriptionStatus !== 'active'
        ) {
          message = 'Assinatura expirada';
        }

        console.info('📊 [SubscriptionStatusService] Assinatura encontrada:', {
          profileId: sub.profile.id,
          isPaid,
          subscriptionStatus: sub.subscriptionStatus,
          source: profileSub ? 'profileSubscription' : 'profile_legacy',
        });

        return {
          isPaid,
          status: sub.subscriptionStatus || 'pending',
          message,
          subscriptionStatus: sub.subscriptionStatus || undefined,
          subscriptionPlan: sub.subscriptionPlan || undefined,
          subscriptionStartDate: sub.subscriptionStartDate,
          subscriptionEndDate: sub.subscriptionEndDate,
        };
      }

      // 3. Se não encontrou no banco, consultar Asaas diretamente
      console.warn('⚠️ [SubscriptionStatusService] Assinatura não encontrada no banco - consultando Asaas');

      return await this.checkPaymentStatusFromAsaas(subscriptionId);

    } catch (error: any) {
      console.error('❌ [SubscriptionStatusService] Erro:', error);
      throw new Error(`Erro ao verificar status: ${error.message}`);
    }
  }

  /**
   * Consulta o status de pagamento diretamente no Asaas
   * Usado quando o profile ainda não foi criado (antes do sign-up)
   */
  private async checkPaymentStatusFromAsaas(
    subscriptionId: string
  ): Promise<SubscriptionStatusResult> {
    try {
      // 1. Buscar a assinatura no Asaas usando lib
      const subscription = await asaasFetch(
        `${asaasApi.subscriptions}/${subscriptionId}`,
        { method: 'GET' }
      );

      console.info('📋 [SubscriptionStatusService] Assinatura encontrada:', {
        id: subscription.id,
        status: subscription.status,
      });

      // 2. Buscar pagamentos da assinatura usando lib
      const paymentsData = await asaasFetch(
        `${asaasApi.payments}?subscription=${subscriptionId}&limit=10`,
        { method: 'GET' }
      );

      const payments = paymentsData.data || [];

      console.info('💰 [SubscriptionStatusService] Pagamentos encontrados:', {
        total: payments.length,
        statuses: payments.map((p: any) => p.status),
      });

      // 3. Verificar se existe algum pagamento confirmado
      const confirmedPayment = payments.find((payment: any) =>
        ['RECEIVED', 'CONFIRMED'].includes(payment.status)
      );

      if (confirmedPayment) {
        console.info(
          '✅ [SubscriptionStatusService] Pagamento confirmado encontrado:',
          {
            id: confirmedPayment.id,
            status: confirmedPayment.status,
          }
        );

        return {
          isPaid: true,
          status: 'paid_pending_signup',
          message: 'Pagamento confirmado - complete seu cadastro',
          paymentId: confirmedPayment.id,
          paymentStatus: confirmedPayment.status,
        };
      }

      // 4. Se não há pagamento confirmado, retornar pendente
      console.warn(
        '⏳ [SubscriptionStatusService] Nenhum pagamento confirmado ainda'
      );

      return {
        isPaid: false,
        status: 'pending',
        message: 'Aguardando confirmação do pagamento',
        payments: payments.map((p: any) => ({
          id: p.id,
          status: p.status,
          value: p.value,
        })),
      };
    } catch (error: any) {
      console.error(
        '❌ [SubscriptionStatusService] Erro ao consultar Asaas:',
        error
      );
      throw error;
    }
  }
}
