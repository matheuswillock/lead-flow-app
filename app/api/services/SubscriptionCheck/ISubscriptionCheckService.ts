export interface CheckSubscriptionResult {
  success: boolean;
  hasActiveSubscription: boolean;
  userExists: boolean;
  userId?: string | null;
  userRole?: string; // 'manager' ou 'operator'
  isPermanent?: boolean; // Indica se é assinatura permanente (bypass Asaas)
  // Where/how we found the user match
  matchSource?: 'email' | 'phone' | 'document';
  matchedIdentifier?: string; // raw value; UI may mask it
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
   * @param cpfCnpj Documento do usuário (CPF/CNPJ)
   * @returns Resultado da verificação
   */
  checkActiveSubscription(email?: string, phone?: string, cpfCnpj?: string): Promise<CheckSubscriptionResult>;
}
