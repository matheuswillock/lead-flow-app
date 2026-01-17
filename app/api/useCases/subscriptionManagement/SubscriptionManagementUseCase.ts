import { Output } from "@/lib/output";
import { prisma } from "@/app/api/infra/data/prisma";
import type { 
  ISubscriptionManagementUseCase, 
  UpdatePaymentMethodDTO 
} from "./ISubscriptionManagementUseCase";

export class SubscriptionManagementUseCase implements ISubscriptionManagementUseCase {
  
  async getSubscription(supabaseId: string): Promise<Output> {
    try {
      // Validação
      if (!supabaseId) {
        return new Output(
          false,
          [],
          ['ID do usuário é obrigatório'],
          null
        );
      }

      // Buscar profile do usuário
      const profile = await prisma.profile.findUnique({
        where: { supabaseId }
      });

      if (!profile) {
        return new Output(
          false,
          [],
          ['Usuário não encontrado'],
          null
        );
      }

      // Verificar se tem asaasSubscriptionId (campo mais confiável)
      if (!profile.asaasSubscriptionId && !profile.hasPermanentSubscription) {
        return new Output(
          true,
          ['Nenhuma assinatura ativa encontrada'],
          [],
          null
        );
      }

      // Contar operadores reais linkados a este manager
      // Incluindo tanto operadores quanto managers (pode ter manager linkado como operador)
      const actualOperatorCount = await prisma.profile.count({
        where: {
          managerId: profile.id,
          role: { in: ['operator', 'manager'] }
        }
      });

      // Calcular valor total: plano base + operadores
      const basePrice = 59.90;
      const operatorPrice = 19.90;
      const operatorCount = actualOperatorCount;
      
      let totalValue = 0;
      // Assinatura vitalícia não tem custo
      if (profile.hasPermanentSubscription) {
        totalValue = 0;
      } else if (profile.subscriptionPlan !== 'free_trial') {
        totalValue = basePrice + (operatorCount * operatorPrice);
      }

      // Formatar dados da assinatura
      const subscriptionData = {
        id: profile.asaasSubscriptionId || 'permanent-subscription',
        subscriptionAsaasId: profile.asaasSubscriptionId || 'permanent-subscription',
        status: profile.hasPermanentSubscription ? 'active' : (profile.subscriptionStatus || 'active'),
        value: totalValue,
        nextDueDate: profile.subscriptionNextDueDate?.toISOString() || profile.subscriptionEndDate?.toISOString() || '',
        cycle: profile.subscriptionCycle || 'MONTHLY',
        description: profile.hasPermanentSubscription ? 'Assinatura Vitalícia (Sem Custo)' :
                     profile.subscriptionPlan === 'free_trial' ? 'Período de teste' :
                     profile.subscriptionPlan === 'manager_base' ? 'Plano Manager Base' :
                     `Plano Manager + ${operatorCount} Operador${operatorCount > 1 ? 'es' : ''}`,
        billingType: 'CREDIT_CARD',
        hasPermanentSubscription: profile.hasPermanentSubscription || false,
        customer: {
          name: profile.fullName || 'Usuário',
          email: profile.email
        },
        externalReference: profile.asaasCustomerId || undefined,
        createdAt: profile.subscriptionStartDate?.toISOString() || profile.createdAt.toISOString(),
        planDetails: {
          plan: profile.subscriptionPlan,
          operatorCount: operatorCount,
          trialEndDate: profile.trialEndDate?.toISOString()
        }
      };

      return new Output(
        true,
        ['Assinatura recuperada com sucesso'],
        [],
        subscriptionData
      );

    } catch (error) {
      console.error('Erro ao buscar assinatura:', error);
      return new Output(
        false,
        [],
        ['Erro interno ao buscar assinatura'],
        null
      );
    }
  }

  async getInvoices(supabaseId: string): Promise<Output> {
    try {
      // Validação
      if (!supabaseId) {
        return new Output(
          false,
          [],
          ['ID do usuário é obrigatório'],
          null
        );
      }

      // Buscar profile do usuário
      const profile = await prisma.profile.findUnique({
        where: { supabaseId }
      });

      if (!profile || !profile.subscriptionId) {
        return new Output(
          true,
          ['Nenhuma fatura encontrada'],
          [],
          []
        );
      }

      // TODO: Buscar faturas da API Asaas
      // Por enquanto, retornar array vazio ou criar uma tabela de histórico de pagamentos
      const invoices: any[] = [];

      return new Output(
        true,
        ['Faturas recuperadas com sucesso'],
        [],
        invoices
      );

    } catch (error) {
      console.error('Erro ao buscar faturas:', error);
      return new Output(
        false,
        [],
        ['Erro interno ao buscar faturas'],
        null
      );
    }
  }

  async cancelSubscription(supabaseId: string, reason?: string): Promise<Output> {
    try {
      // Mark optional param as intentionally unused for now
      void reason;
      // Validação
      if (!supabaseId) {
        return new Output(
          false,
          [],
          ['ID do usuário é obrigatório'],
          null
        );
      }

      // Buscar profile
      const profile = await prisma.profile.findUnique({
        where: { supabaseId }
      });

      if (!profile || !profile.subscriptionId) {
        return new Output(
          false,
          [],
          ['Assinatura não encontrada'],
          null
        );
      }

      // Atualizar status da assinatura
      await prisma.profile.update({
        where: { id: profile.id },
        data: {
          subscriptionStatus: 'canceled',
          subscriptionEndDate: new Date()
        }
      });

      // TODO: Chamar API Asaas para cancelar assinatura
      // await asaasService.cancelSubscription(profile.subscriptionId);

      return new Output(
        true,
        ['Assinatura cancelada com sucesso'],
        [],
        { cancelledAt: new Date().toISOString() }
      );

    } catch (error) {
      console.error('Erro ao cancelar assinatura:', error);
      return new Output(
        false,
        [],
        ['Erro interno ao cancelar assinatura'],
        null
      );
    }
  }

  async updatePaymentMethod(
    supabaseId: string, 
    paymentData: UpdatePaymentMethodDTO
  ): Promise<Output> {
    try {
      // Validações
      if (!supabaseId) {
        return new Output(
          false,
          [],
          ['ID do usuário é obrigatório'],
          null
        );
      }

      const errors: string[] = [];
      if (!paymentData.creditCardHolderName) errors.push('Nome do titular é obrigatório');
      if (!paymentData.creditCardNumber) errors.push('Número do cartão é obrigatório');
      if (!paymentData.creditCardExpiryMonth) errors.push('Mês de validade é obrigatório');
      if (!paymentData.creditCardExpiryYear) errors.push('Ano de validade é obrigatório');
      if (!paymentData.creditCardCcv) errors.push('CVV é obrigatório');

      if (errors.length > 0) {
        return new Output(false, [], errors, null);
      }

      // Buscar profile
      const profile = await prisma.profile.findUnique({
        where: { supabaseId }
      });

      if (!profile || !profile.subscriptionId) {
        return new Output(
          false,
          [],
          ['Assinatura não encontrada'],
          null
        );
      }

      // TODO: Atualizar método de pagamento na API Asaas
      // await asaasService.updatePaymentMethod(
      //   profile.subscriptionId,
      //   paymentData
      // );

      return new Output(
        true,
        ['Método de pagamento atualizado com sucesso'],
        [],
        { updatedAt: new Date().toISOString() }
      );

    } catch (error) {
      console.error('Erro ao atualizar método de pagamento:', error);
      return new Output(
        false,
        [],
        ['Erro interno ao atualizar método de pagamento'],
        null
      );
    }
  }

  async retryPayment(supabaseId: string, invoiceId: string): Promise<Output> {
    try {
      // Validações
      if (!supabaseId) {
        return new Output(
          false,
          [],
          ['ID do usuário é obrigatório'],
          null
        );
      }

      if (!invoiceId) {
        return new Output(
          false,
          [],
          ['ID da fatura é obrigatório'],
          null
        );
      }

      // Buscar profile
      const profile = await prisma.profile.findUnique({
        where: { supabaseId }
      });

      if (!profile || !profile.subscriptionId) {
        return new Output(
          false,
          [],
          ['Assinatura não encontrada'],
          null
        );
      }

      // TODO: Retentar pagamento na API Asaas
      // await asaasService.retryPayment(invoiceId);

      return new Output(
        true,
        ['Tentativa de pagamento iniciada'],
        [],
        { retriedAt: new Date().toISOString() }
      );

    } catch (error) {
      console.error('Erro ao retentar pagamento:', error);
      return new Output(
        false,
        [],
        ['Erro interno ao retentar pagamento'],
        null
      );
    }
  }
}

// Instância única
export const subscriptionManagementUseCase = new SubscriptionManagementUseCase();
