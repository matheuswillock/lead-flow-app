import { CheckSubscriptionResult } from '../../services/SubscriptionCheck/ISubscriptionCheckService';

export interface CheckSubscriptionDTO {
  email?: string;
  cpfCnpj?: string;
  phone?: string;
}

export interface ICheckSubscriptionUseCase {
  /**
   * Executa a verificação de assinatura ativa
   * @param data Dados para verificação (email, cpfCnpj, phone)
   * @returns Resultado da verificação
   */
  execute(data: CheckSubscriptionDTO): Promise<CheckSubscriptionResult>;
}
