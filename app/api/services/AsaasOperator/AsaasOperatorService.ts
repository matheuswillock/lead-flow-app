// app/api/services/AsaasOperatorService.ts
import { AsaasSubscriptionService } from '../AsaasSubscription/AsaasSubscriptionService';
import { prisma } from '@/app/api/infra/data/prisma';

export interface OperatorBilling {
  basePlan: number;
  operatorCost: number;
  activeOperators: number;
  totalCost: number;
  breakdown: {
    manager: number;
    operators: number;
  };
}

import type { IAsaasOperatorService } from './IAsaasOperatorService';

export class AsaasOperatorService implements IAsaasOperatorService {
  addOperator: IAsaasOperatorService['addOperator'] = AsaasOperatorService.addOperator;
  removeOperator: IAsaasOperatorService['removeOperator'] = AsaasOperatorService.removeOperator;
  calculateMonthlyBilling: IAsaasOperatorService['calculateMonthlyBilling'] = AsaasOperatorService.calculateMonthlyBilling;
  listOperators: IAsaasOperatorService['listOperators'] = AsaasOperatorService.listOperators;
  transferOperator: IAsaasOperatorService['transferOperator'] = AsaasOperatorService.transferOperator;
  suspendOperator: IAsaasOperatorService['suspendOperator'] = AsaasOperatorService.suspendOperator;
  reactivateOperator: IAsaasOperatorService['reactivateOperator'] = AsaasOperatorService.reactivateOperator;
  /**
   * Adiciona operador e cria assinatura (R$ 19,90/mês)
   */
  static async addOperator(managerId: string, operatorId: string) {
    try {
      // 1. Buscar Manager
      const manager = await prisma.profile.findUnique({
        where: { id: managerId },
        select: {
          id: true,
          asaasCustomerId: true,
          subscriptionId: true,
          subscriptionStatus: true,
          fullName: true,
        },
      });

      if (!manager) {
        throw new Error('Manager não encontrado');
      }

      if (!manager.asaasCustomerId) {
        throw new Error('Manager não possui cliente Asaas. Crie uma assinatura primeiro.');
      }

      if (!manager.subscriptionId) {
        throw new Error('Manager não possui assinatura ativa. Crie a assinatura base primeiro.');
      }

      // 2. Buscar Operador
      const operator = await prisma.profile.findUnique({
        where: { id: operatorId },
        select: {
          id: true,
          fullName: true,
          email: true,
          subscriptionId: true,
          managerId: true,
        },
      });

      if (!operator) {
        throw new Error('Operador não encontrado');
      }

      if (operator.subscriptionId) {
        throw new Error('Operador já possui assinatura ativa');
      }

      if (operator.managerId && operator.managerId !== managerId) {
        throw new Error('Operador já está vinculado a outro Manager');
      }

      // 3. Criar assinatura do operador no Asaas
      const subscription = await AsaasSubscriptionService.createOperatorSubscription({
        customer: manager.asaasCustomerId,
        billingType: 'CREDIT_CARD', // Herda do Manager ou define padrão
        value: 19.90,
        cycle: 'MONTHLY',
        description: `Operador: ${operator.fullName || operator.email}`,
        externalReference: operatorId,
      });

      // 4. Atualizar Operador
      await prisma.profile.update({
        where: { id: operatorId },
        data: {
          subscriptionId: subscription.subscriptionId,
          subscriptionStatus: 'active',
          managerId: managerId,
        },
      });

      // 5. Atualizar contagem de operadores do Manager
      const currentOperatorsCount = await prisma.profile.count({
        where: {
          managerId: managerId,
          subscriptionStatus: 'active',
        },
      });

      await prisma.profile.update({
        where: { id: managerId },
        data: {
          operatorCount: currentOperatorsCount,
          subscriptionPlan: 'with_operators',
        },
      });

      console.info(`✅ Operador adicionado: ${operatorId} ao Manager: ${managerId}`);

      return {
        success: true,
        subscriptionId: subscription.subscriptionId,
        operatorId,
        managerId,
        value: 19.90,
        message: 'Operador adicionado com sucesso',
      };

    } catch (error: any) {
      console.error('❌ Erro ao adicionar operador:', error);
      throw error;
    }
  }

  /**
   * Remove operador e cancela assinatura
   */
  static async removeOperator(operatorId: string) {
    try {
      // 1. Buscar Operador
      const operator = await prisma.profile.findUnique({
        where: { id: operatorId },
        include: {
          manager: {
            select: {
              id: true,
              fullName: true,
            },
          },
        },
      });

      if (!operator?.subscriptionId) {
        throw new Error('Operador não possui assinatura ativa');
      }

      const managerId = operator.managerId;

      // 2. Cancelar assinatura no Asaas
      try {
        await AsaasSubscriptionService.cancelSubscription(operator.subscriptionId);
        console.info(`✅ Assinatura Asaas cancelada: ${operator.subscriptionId}`);
      } catch (asaasError: any) {
        console.error('⚠️ Erro ao cancelar assinatura no Asaas:', asaasError.message);
        // Continua mesmo se falhar no Asaas (pode já estar cancelada)
      }

      // 3. Atualizar Operador
      await prisma.profile.update({
        where: { id: operatorId },
        data: {
          subscriptionId: null,
          subscriptionStatus: 'canceled',
          managerId: null,
        },
      });

      // 4. Atualizar contagem do Manager
      if (managerId) {
        const remainingOperators = await prisma.profile.count({
          where: {
            managerId: managerId,
            subscriptionStatus: 'active',
          },
        });

        await prisma.profile.update({
          where: { id: managerId },
          data: {
            operatorCount: remainingOperators,
            subscriptionPlan: remainingOperators === 0 ? 'manager_base' : 'with_operators',
          },
        });
      }

      console.info(`✅ Operador removido: ${operatorId}`);

      return {
        success: true,
        operatorId,
        managerId: managerId ?? '',
        message: 'Operador removido e assinatura cancelada com sucesso',
      };
    } catch (error: any) {
      console.error('❌ Erro ao remover operador:', error);
      throw error;
    }
  }

  /**
   * Calcula billing total do Manager
   */
  static async calculateMonthlyBilling(managerId: string): Promise<OperatorBilling> {
    try {
      const manager = await prisma.profile.findUnique({
        where: { id: managerId },
        include: {
          operators: {
            where: {
              subscriptionStatus: 'active',
            },
            select: {
              id: true,
              fullName: true,
              email: true,
              subscriptionStatus: true,
            },
          },
        },
      });

      if (!manager) {
        throw new Error('Manager não encontrado');
      }

      const basePlan = 59.90;
      const operatorCost = 19.90;
      const activeOperators = manager.operators.length;
      const totalCost = basePlan + (activeOperators * operatorCost);

      return {
        basePlan,
        operatorCost,
        activeOperators,
        totalCost,
        breakdown: {
          manager: basePlan,
          operators: activeOperators * operatorCost,
        },
      };
    } catch (error: any) {
      console.error('❌ Erro ao calcular billing:', error);
      throw new Error('Erro ao calcular custo mensal');
    }
  }

  /**
   * Lista operadores de um Manager
   */
  static async listOperators(managerId: string, includeInactive = false) {
    try {
      const operators = await prisma.profile.findMany({
        where: {
          managerId: managerId,
          ...(includeInactive ? {} : { subscriptionStatus: 'active' }),
        },
        select: {
          id: true,
          email: true,
          fullName: true,
          phone: true,
          role: true,
          subscriptionId: true,
          subscriptionStatus: true,
          createdAt: true,
        },
        orderBy: {
          createdAt: 'desc',
        },
      });

      return {
        operators,
        count: operators.length,
      };
    } catch (error: any) {
      console.error('❌ Erro ao listar operadores:', error);
      throw new Error('Erro ao listar operadores');
    }
  }

  /**
   * Transfere operador para outro Manager
   */
  static async transferOperator(
    operatorId: string,
    newManagerId: string
  ) {
    try {
      // 1. Remover do Manager atual
      await this.removeOperator(operatorId);

      // 2. Adicionar ao novo Manager
      const result = await this.addOperator(newManagerId, operatorId);

      console.info(`✅ Operador transferido: ${operatorId} para Manager: ${newManagerId}`);

      return {
        oldManagerId: null, // Já foi removido
        newManagerId,
        transferred: true,
        ...result,
      };
    } catch (error: any) {
      console.error('❌ Erro ao transferir operador:', error);
      throw error;
    }
  }

  /**
   * Suspende operador (mantém vínculo mas cancela assinatura)
   */
  static async suspendOperator(operatorId: string) {
    try {
      const operator = await prisma.profile.findUnique({
        where: { id: operatorId },
        select: {
          id: true,
          subscriptionId: true,
          managerId: true,
        },
      });

      if (!operator) {
        throw new Error('Operador não encontrado');
      }

      if (operator.subscriptionId) {
        await AsaasSubscriptionService.cancelSubscription(operator.subscriptionId);
      }

      await prisma.profile.update({
        where: { id: operatorId },
        data: {
          subscriptionStatus: 'suspended',
          subscriptionId: null,
        },
      });

      // Atualizar contagem do Manager
      if (operator.managerId) {
        const activeOperators = await prisma.profile.count({
          where: {
            managerId: operator.managerId,
            subscriptionStatus: 'active',
          },
        });

        await prisma.profile.update({
          where: { id: operator.managerId },
          data: {
            operatorCount: activeOperators,
          },
        });
      }

      console.info(`⏸️ Operador suspenso: ${operatorId}`);

        return {
          suspended: true,
          operatorId,
        };
    } catch (error: any) {
      console.error('❌ Erro ao suspender operador:', error);
      throw error;
    }
  }

  /**
   * Reativa operador suspenso
   */
  static async reactivateOperator(operatorId: string) {
    try {
      const operator = await prisma.profile.findUnique({
        where: { id: operatorId },
        select: {
          id: true,
          managerId: true,
          subscriptionStatus: true,
        },
      });

      if (!operator) {
        throw new Error('Operador não encontrado');
      }

      if (!operator.managerId) {
        throw new Error('Operador não está vinculado a um Manager');
      }

      if (operator.subscriptionStatus === 'active') {
        throw new Error('Operador já está ativo');
      }

      // Recriar assinatura
      const result = await this.addOperator(operator.managerId, operatorId);

      console.info(`▶️ Operador reativado: ${operatorId}`);

      return {
        reactivated: true,
        ...result,
      };
    } catch (error: any) {
      console.error('❌ Erro ao reativar operador:', error);
      throw error;
    }
  }
}

export const asaasOperatorService = new AsaasOperatorService();