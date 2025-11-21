import { Profile } from '@prisma/client';

export interface ISubscriptionRepository {
  /**
   * Busca um perfil por email ou telefone
   * @param email Email do usuário
   * @param phone Telefone do usuário
   * @param cpfCnpj Documento do usuário
   * @returns Profile ou null se não encontrado
   */
  findProfileByEmailOrPhone(email?: string, phone?: string, cpfCnpj?: string): Promise<Profile | null>;
  
  /**
   * Busca um perfil por ID
   * @param id ID do perfil
   * @returns Profile ou null se não encontrado
   */
  findProfileById(id: string): Promise<Profile | null>;
}
