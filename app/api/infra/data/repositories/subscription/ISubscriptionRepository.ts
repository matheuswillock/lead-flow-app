import type { Prisma } from '@prisma/client';

export type SubscriptionProfile = Prisma.ProfileGetPayload<{
  select: {
    id: true;
    supabaseId: true;
    email: true;
    phone: true;
    cpfCnpj: true;
    fullName: true;
    role: true;
    isMaster: true;
    managerId: true;
    operatorCount: true;
    subscription: {
      select: {
        asaasCustomerId: true;
        asaasSubscriptionId: true;
        subscriptionStatus: true;
        subscriptionStartDate: true;
        subscriptionEndDate: true;
        subscriptionNextDueDate: true;
        subscriptionPlan: true;
        subscriptionCycle: true;
        hasPermanentSubscription: true;
      };
    };
  };
}>;

export interface ISubscriptionRepository {
  /**
   * Busca um perfil por email ou telefone
   * @param email Email do usuário
   * @param phone Telefone do usuário
   * @param cpfCnpj Documento do usuário
   * @returns Profile ou null se não encontrado
   */
  findProfileByEmailOrPhone(email?: string, phone?: string, cpfCnpj?: string): Promise<SubscriptionProfile | null>;
  
  /**
   * Busca um perfil por ID
   * @param id ID do perfil
   * @returns Profile ou null se não encontrado
   */
  findProfileById(id: string): Promise<SubscriptionProfile | null>;
}
