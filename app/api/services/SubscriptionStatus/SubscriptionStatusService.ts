// app/api/services/SubscriptionStatus/SubscriptionStatusService.ts

import {
  ISubscriptionStatusService,
  SubscriptionStatusResult,
} from "./ISubscriptionStatusService";
import { prisma } from "../../infra/data/prisma";

export class SubscriptionStatusService implements ISubscriptionStatusService {
  
  async checkPaymentStatus(subscriptionId: string): Promise<SubscriptionStatusResult> {
    try {
      console.info('🔍 [SubscriptionStatusService] Buscando profile no banco...');

      // 1. Primeiro tentar buscar no banco de dados
      const profile = await prisma.profile.findFirst({
        where: {
          subscriptionId: subscriptionId,
        },
        select: {
          id: true,
          email: true,
          subscriptionStatus: true,
          subscriptionPlan: true,
          subscriptionStartDate: true,
          subscriptionEndDate: true,
        },
      });

      // 2. Se encontrou o profile, retornar status do banco
      if (profile) {
        const isPaid = profile.subscriptionStatus === 'active';

        console.info('📊 [SubscriptionStatusService] Profile encontrado:', {
          profileId: profile.id,
          isPaid,
          subscriptionStatus: profile.subscriptionStatus,
        });

        return {
          isPaid,
          status: profile.subscriptionStatus || 'pending',
          message: isPaid ? 'Assinatura ativa' : 'Assinatura pendente',
          subscriptionStatus: profile.subscriptionStatus || undefined,
          subscriptionPlan: profile.subscriptionPlan || undefined,
          subscriptionStartDate: profile.subscriptionStartDate,
          subscriptionEndDate: profile.subscriptionEndDate,
        };
      }

      // 3. Se não encontrou profile, consultar Asaas diretamente
      console.warn('⚠️ [SubscriptionStatusService] Profile não encontrado - consultando Asaas');

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
      // 1. Buscar a assinatura no Asaas
      const asaasUrl = process.env.ASAAS_URL?.replace(/\/$/, ''); // Remove trailing slash
      const subscriptionResponse = await fetch(
        `${asaasUrl}/api/v3/subscriptions/${subscriptionId}`,
        {
          headers: {
            'Content-Type': 'application/json',
            access_token: process.env.ASAAS_API_KEY || '',
          },
        }
      );

      console.info('🌐 [SubscriptionStatusService] URL consultada:', `${asaasUrl}/api/v3/subscriptions/${subscriptionId}`);

      if (!subscriptionResponse.ok) {
        console.error(
          '❌ [SubscriptionStatusService] Erro ao consultar assinatura no Asaas:',
          subscriptionResponse.status
        );
        throw new Error('Erro ao verificar assinatura no Asaas');
      }

      const subscription = await subscriptionResponse.json();
      console.info('📋 [SubscriptionStatusService] Assinatura encontrada:', {
        id: subscription.id,
        status: subscription.status,
      });

      // 2. Buscar pagamentos da assinatura
      const paymentsResponse = await fetch(
        `${asaasUrl}/api/v3/payments?subscription=${subscriptionId}&limit=10`,
        {
          headers: {
            'Content-Type': 'application/json',
            access_token: process.env.ASAAS_API_KEY || '',
          },
        }
      );

      if (!paymentsResponse.ok) {
        console.error(
          '❌ [SubscriptionStatusService] Erro ao consultar pagamentos no Asaas:',
          paymentsResponse.status
        );
        throw new Error('Erro ao verificar pagamentos no Asaas');
      }

      const paymentsData = await paymentsResponse.json();
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
