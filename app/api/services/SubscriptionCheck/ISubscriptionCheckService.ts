export interface CheckSubscriptionResult {
  success: boolean;
  hasActiveSubscription: boolean;
  userExists: boolean;
  userId?: string | null;
  subscription?: {
    id: string | null;
    status: string | null;
    startDate?: Date | null;
    endDate?: Date | null;
    plan?: string | null;
    operatorCount?: number;
  };
}

export interface ISubscriptionCheckService {
  /**
   * Verifica se um usuário já possui assinatura ativa
   * @param email Email do usuário
   * @param phone Telefone do usuário
   * @returns Resultado da verificação
   */
  checkActiveSubscription(email?: string, phone?: string): Promise<CheckSubscriptionResult>;
}
