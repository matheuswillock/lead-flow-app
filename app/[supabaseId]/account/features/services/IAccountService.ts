import { updateAccountFormData } from "@/lib/types/formTypes";
import { Output } from "@/lib/output";

/**
 * Interface para o serviço de conta de usuários
 * Seguindo o princípio de Dependency Inversion (SOLID)
 */
export interface IAccountService {
  /**
   * Atualiza os dados da conta do usuário
   * @param supabaseId - ID do usuário no Supabase
   * @param data - Dados do usuário para atualização
   * @returns Promise com o resultado da operação
   */
  updateAccount(supabaseId: string, data: updateAccountFormData): Promise<Output>;

  /**
   * Faz upload do ícone de perfil
   * @param supabaseId - ID do usuário no Supabase
   * @param file - Arquivo de imagem para upload
   * @returns Promise com o resultado da operação
   */
  uploadProfileIcon(supabaseId: string, file: File): Promise<Output>;

  /**
   * Remove o ícone de perfil
   * @param supabaseId - ID do usuário no Supabase
   * @returns Promise com o resultado da operação
   */
  deleteProfileIcon(supabaseId: string): Promise<Output>;

  /**
   * Atualiza a senha do usuário
   * @param supabaseId - ID do usuário no Supabase
   * @param newPassword - Nova senha
   * @returns Promise com o resultado da operação
   */
  updatePassword(supabaseId: string, newPassword: string): Promise<Output>;
}