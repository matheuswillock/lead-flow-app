// app/api/useCases/CreateManagerOnboarding.ts
/**
 * Use Case: Onboarding completo de Manager
 * 
 * Responsabilidades:
 * 1. Criar cliente no Asaas
 * 2. Criar assinatura base (R$ 59,90/mês)
 * 3. Atualizar Profile com dados de assinatura
 * 
 * Segue princípio SOLID - Dependency Inversion:
 * - Depende de interfaces, não de implementações concretas
 * - Facilita testes unitários com mocks
 */

import type { IAsaasCustomerService, IAsaasSubscriptionService } from '@/app/api/services';
import { prisma } from '@/app/api/infra/data/prisma';

export interface CreateManagerOnboardingInput {
  profileId: string;
  billingType?: 'PIX' | 'CREDIT_CARD' | 'BOLETO';
}

export interface CreateManagerOnboardingOutput {
  success: boolean;
  customerId: string;
  subscriptionId: string;
  message: string;
}

export class CreateManagerOnboarding {
  constructor(
    private customerService: IAsaasCustomerService,
    private subscriptionService: IAsaasSubscriptionService
  ) {}

  async execute(input: CreateManagerOnboardingInput): Promise<CreateManagerOnboardingOutput> {
    const { profileId, billingType = 'CREDIT_CARD' } = input;

    try {
      // 1. Buscar perfil
      const profile = await prisma.profile.findUnique({
        where: { id: profileId },
        select: {
          id: true,
          fullName: true,
          email: true,
          phone: true,
          asaasCustomerId: true,
          asaasSubscriptionId: true,
          subscriptionId: true,
        },
      });

      if (!profile) {
        throw new Error('Profile não encontrado');
      }

      if (profile.asaasCustomerId) {
        throw new Error('Manager já possui cliente Asaas cadastrado');
      }

      if (profile.subscriptionId || profile.asaasSubscriptionId) {
        throw new Error('Manager já possui assinatura ativa');
      }

      // 2. Criar cliente no Asaas
      // Nota: CPF/CNPJ deve ser fornecido manualmente ou adicionado ao Profile posteriormente
      console.info('📝 Criando cliente no Asaas...');
      const customer = await this.customerService.createCustomer({
        name: profile.fullName || profile.email,
        cpfCnpj: '00000000000', // TODO: Adicionar campo CPF/CNPJ ao Profile
        email: profile.email,
        phone: profile.phone?.replace(/\D/g, ''),
        externalReference: profileId,
      });

      console.info(`✅ Cliente Asaas criado: ${customer.customerId}`);

      // 3. Atualizar profile com customerId
      await prisma.profile.update({
        where: { id: profileId },
        data: { asaasCustomerId: customer.customerId },
      });

      // 4. Criar assinatura base (R$ 59,90/mês)
      console.info('💰 Criando assinatura Manager...');
      const subscription = await this.subscriptionService.createManagerSubscription({
        customer: customer.customerId,
        billingType,
        value: 59.90, // Valor fixo do plano Manager
        cycle: 'MONTHLY',
        description: 'Assinatura Lead Flow - Plano Manager',
        externalReference: profileId,
      });

      console.info(`✅ Assinatura criada: ${subscription.subscriptionId}`);

      // 5. Atualizar profile com dados de assinatura
      const profileSubscription = await prisma.profileSubscription.upsert({
        where: { profileId },
        create: {
          profileId,
          asaasCustomerId: customer.customerId,
          asaasSubscriptionId: subscription.subscriptionId,
          subscriptionStatus: 'active',
          subscriptionPlan: 'manager_base',
          subscriptionStartDate: new Date(),
        },
        update: {
          asaasCustomerId: customer.customerId,
          asaasSubscriptionId: subscription.subscriptionId,
          subscriptionStatus: 'active',
          subscriptionPlan: 'manager_base',
          subscriptionStartDate: new Date(),
        },
        select: { id: true },
      });

      await prisma.profile.update({
        where: { id: profileId },
        data: {
          subscriptionId: profileSubscription.id,
          asaasSubscriptionId: subscription.subscriptionId,
          subscriptionStatus: 'active',
          subscriptionPlan: 'manager_base',
          subscriptionStartDate: new Date(),
        },
      });

      console.info('🎉 Onboarding completo!');

      return {
        success: true,
        customerId: customer.customerId,
        subscriptionId: subscription.subscriptionId,
        message: 'Onboarding completo com sucesso. Assinatura ativa!',
      };
    } catch (error: any) {
      console.error('❌ Erro no onboarding:', error);
      throw error;
    }
  }
}
