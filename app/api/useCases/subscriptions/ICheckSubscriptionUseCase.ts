import type { Output } from "@/lib/output";

export interface CheckSubscriptionDTO {
  email?: string;
  cpfCnpj?: string;
  phone?: string;
}

export interface ICheckSubscriptionUseCase {
  /**
   * Executa a verificação de assinatura ativa
   * @param data Dados para verificação (email, cpfCnpj, phone)
   * @returns Output padronizado contendo o resultado da verificação
   */
  execute(data: CheckSubscriptionDTO): Promise<Output>;
}
