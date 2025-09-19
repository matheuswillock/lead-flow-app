import { updateAccountFormData } from "@/lib/types/formTypes";
import { Output } from "@/lib/output";
import { IAccountService } from "./IAccountService";

/**
 * Implementação concreta do serviço de conta de usuários
 * Implementa IAccountService seguindo os princípios SOLID
 */
export class AccountService implements IAccountService {
  /**
   * Atualiza os dados da conta do usuário através da API
   * @param supabaseId - ID do usuário no Supabase
   * @param data - Dados do usuário para atualização
   * @returns Promise com o resultado da operação
   */
  async updateAccount(supabaseId: string, data: updateAccountFormData): Promise<Output> {
    try {
      const response = await fetch(`/api/v1/profiles/${supabaseId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "x-supabase-user-id": supabaseId,
        },
        body: JSON.stringify({
          fullName: data.fullName,
          email: data.email,
          phone: data.phone,
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      return result;
    } catch (error) {
      console.error("Erro ao atualizar conta:", error);
      return new Output(false, [], ["Erro ao conectar com o servidor"], null);
    }
  }

  /**
   * Faz upload do ícone de perfil através da API
   * @param supabaseId - ID do usuário no Supabase
   * @param file - Arquivo de imagem para upload
   * @returns Promise com o resultado da operação
   */
  async uploadProfileIcon(supabaseId: string, file: File): Promise<Output> {
    try {
      const formData = new FormData();
      formData.append("profileIcon", file);

      const response = await fetch(`/api/v1/profiles/${supabaseId}/icon`, {
        method: "PUT",
        headers: {
          "x-supabase-user-id": supabaseId,
        },
        body: formData,
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      return result;
    } catch (error) {
      console.error("Erro ao fazer upload do ícone:", error);
      return new Output(false, [], ["Erro ao fazer upload da imagem"], null);
    }
  }

  /**
   * Remove o ícone de perfil através da API
   * @param supabaseId - ID do usuário no Supabase
   * @returns Promise com o resultado da operação
   */
  async deleteProfileIcon(supabaseId: string): Promise<Output> {
    try {
      const response = await fetch(`/api/v1/profiles/${supabaseId}/icon`, {
        method: "DELETE",
        headers: {
          "x-supabase-user-id": supabaseId,
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      return result;
    } catch (error) {
      console.error("Erro ao remover ícone:", error);
      return new Output(false, [], ["Erro ao remover imagem"], null);
    }
  }

  /**
   * Atualiza a senha do usuário através da API
   * @param supabaseId - ID do usuário no Supabase
   * @param newPassword - Nova senha
   * @returns Promise com o resultado da operação
   */
  async updatePassword(supabaseId: string, newPassword: string): Promise<Output> {
    try {
      const response = await fetch(`/api/v1/profiles/${supabaseId}/password`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "x-supabase-user-id": supabaseId,
        },
        body: JSON.stringify({ newPassword }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      return result;
    } catch (error) {
      console.error("Erro ao atualizar senha:", error);
      return new Output(false, [], ["Erro ao atualizar senha"], null);
    }
  }
}

/**
 * Factory function para criar uma instância do serviço de conta
 * Facilita a injeção de dependência e testes
 */
export function createAccountService(): IAccountService {
  return new AccountService();
}