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

      // 1. Primeiro tentar buscar a assinatura centralizada
      const profileSubscription = await prisma.profileSubscription.findFirst({
        where: {
          asaasSubscriptionId: subscriptionId,
        },
        select: {
          id: true,
          profileId: true,
          asaasCustomerId: true,
          asaasSubscriptionId: true,
          subscriptionStatus: true,
          subscriptionPlan: true,
          subscriptionStartDate: true,
          subscriptionEndDate: true,
          subscriptionNextDueDate: true,
          subscriptionCycle: true,
          trialEndDate: true,
          hasPermanentSubscription: true,
          profile: {
            select: {
              email: true,
              timezone: true,
              supabaseId: true,
            },
          },
        },
      });

      if (profileSubscription) {
        const isPaid = profileSubscription.subscriptionStatus === 'active';
        const timezone = resolveTimezone(profileSubscription.profile?.timezone);
        let message = isPaid ? 'Assinatura ativa' : 'Assinatura pendente';

        if (profileSubscription.subscriptionStatus === 'trial' && profileSubscription.trialEndDate) {
          if (isPastInTz(profileSubscription.trialEndDate, timezone)) {
            message = 'Período de teste expirado';
          } else {
            const remainingDays = Math.max(
              0,
              differenceInDaysInTz(profileSubscription.trialEndDate, new Date(), timezone)
            );
            message =
              remainingDays > 0
                ? `Período de teste ativo (${remainingDays} dia(s) restantes)`
                : 'Período de teste ativo';
          }
        } else if (
          profileSubscription.subscriptionEndDate &&
          isPastInTz(profileSubscription.subscriptionEndDate, timezone) &&
          profileSubscription.subscriptionStatus !== 'active'
        ) {
          message = 'Assinatura expirada';
        }

        console.info('📊 [SubscriptionStatusService] Assinatura encontrada:', {
          profileId: profileSubscription.profileId,
          isPaid,
          subscriptionStatus: profileSubscription.subscriptionStatus,
        });

        return {
          isPaid,
          status: profileSubscription.subscriptionStatus || 'pending',
          message,
          subscriptionStatus: profileSubscription.subscriptionStatus || undefined,
          subscriptionPlan: profileSubscription.subscriptionPlan || undefined,
          subscriptionStartDate: profileSubscription.subscriptionStartDate,
          subscriptionEndDate: profileSubscription.subscriptionEndDate,
        };
      }

      // 2. Fallback para assinaturas antigas ainda espelhadas em Profile
      const profile = await prisma.profile.findFirst({
        where: {
          asaasSubscriptionId: subscriptionId,
        },
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
      });

      if (profile) {
        const isPaid = profile.subscriptionStatus === 'active';
        const timezone = resolveTimezone(profile.timezone);
        let message = isPaid ? 'Assinatura ativa' : 'Assinatura pendente';

        if (profile.subscriptionStatus === 'trial' && profile.trialEndDate) {
          if (isPastInTz(profile.trialEndDate, timezone)) {
            message = 'Período de teste expirado';
          } else {
            const remainingDays = Math.max(
              0,
              differenceInDaysInTz(profile.trialEndDate, new Date(), timezone)
            );
            message =
              remainingDays > 0
                ? `Período de teste ativo (${remainingDays} dia(s) restantes)`
                : 'Período de teste ativo';
          }
        } else if (
          profile.subscriptionEndDate &&
          isPastInTz(profile.subscriptionEndDate, timezone) &&
          profile.subscriptionStatus !== 'active'
        ) {
          message = 'Assinatura expirada';
        }

        console.info('📊 [SubscriptionStatusService] Profile legado encontrado:', {
          profileId: profile.id,
          isPaid,
          subscriptionStatus: profile.subscriptionStatus,
        });

        return {
          isPaid,
          status: profile.subscriptionStatus || 'pending',
          message,
          subscriptionStatus: profile.subscriptionStatus || undefined,
          subscriptionPlan: profile.subscriptionPlan || undefined,
          subscriptionStartDate: profile.subscriptionStartDate,
          subscriptionEndDate: profile.subscriptionEndDate,
        };
      }

      // 3. Se não encontrou nada local, consultar Asaas diretamente
      console.warn('⚠️ [SubscriptionStatusService] Assinatura não encontrada localmente - consultando Asaas');

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
