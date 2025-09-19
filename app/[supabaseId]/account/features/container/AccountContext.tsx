"use client";
import React, { createContext, useContext, useState, ReactNode } from "react";
import { updateAccountFormData } from "@/lib/types/formTypes";
import { Output } from "@/lib/output";
import { IAccountService } from "../services/IAccountService";
import { createAccountService } from "../services/AccountService";
import { toast } from "sonner";

/**
 * Interface para o estado do contexto de conta
 */
interface AccountContextState {
  isLoading: boolean;
  isUpdating: boolean;
  isUploadingIcon: boolean;
  errors: Record<string, string>;
  updateAccount: (supabaseId: string, data: updateAccountFormData) => Promise<Output>;
  uploadProfileIcon: (supabaseId: string, file: File) => Promise<Output>;
  deleteProfileIcon: (supabaseId: string) => Promise<Output>;
  updatePassword: (supabaseId: string, newPassword: string) => Promise<Output>;
  clearErrors: () => void;
}

/**
 * Propriedades do provider do contexto
 */
interface AccountProviderProps {
  children: ReactNode;
  accountService?: IAccountService;
}

/**
 * Context para gerenciar o estado da conta de usuários
 * Segue o princípio de Dependency Inversion usando a interface do serviço
 */
const AccountContext = createContext<AccountContextState | undefined>(undefined);

/**
 * Provider do contexto de conta
 * Gerencia o estado e lógica de negócio relacionada à conta do usuário
 */
export const AccountProvider: React.FC<AccountProviderProps> = ({ 
  children, 
  accountService = createAccountService()
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [isUploadingIcon, setIsUploadingIcon] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  /**
   * Atualiza os dados da conta do usuário
   * @param supabaseId - ID do usuário no Supabase
   * @param data - Dados do formulário de atualização da conta
   * @returns Resultado da operação de atualização
   */
  const updateAccount = async (supabaseId: string, data: updateAccountFormData): Promise<Output> => {
    setIsUpdating(true);
    setErrors({});

    try {
      const result = await accountService.updateAccount(supabaseId, data);

      if (!result.isValid) {
        // Mapear erros para o estado
        const formErrors: Record<string, string> = {};
        result.errorMessages.forEach((error, index) => {
          formErrors[`field_${index}`] = error;
        });
        setErrors(formErrors);
        
        // Mostrar toast de erro
        toast.error(result.errorMessages[0] || "Erro ao atualizar dados da conta");
      } else {
        // Mostrar toast de sucesso
        toast.success("Dados da conta atualizados com sucesso!");
      }

      return result;
    } catch (error) {
      console.error("Erro ao atualizar conta:", error);
      const errorMessage = "Erro inesperado ao atualizar conta";
      setErrors({ general: errorMessage });
      toast.error(errorMessage);
      return new Output(false, [], [errorMessage], null);
    } finally {
      setIsUpdating(false);
    }
  };

  /**
   * Faz upload do ícone de perfil
   * @param supabaseId - ID do usuário no Supabase
   * @param file - Arquivo de imagem para upload
   * @returns Resultado da operação de upload
   */
  const uploadProfileIcon = async (supabaseId: string, file: File): Promise<Output> => {
    setIsUploadingIcon(true);
    setErrors({});

    try {
      const result = await accountService.uploadProfileIcon(supabaseId, file);

      if (!result.isValid) {
        toast.error(result.errorMessages[0] || "Erro ao fazer upload da imagem");
      } else {
        toast.success("Imagem de perfil atualizada com sucesso!");
      }

      return result;
    } catch (error) {
      console.error("Erro ao fazer upload da imagem:", error);
      const errorMessage = "Erro inesperado ao fazer upload da imagem";
      toast.error(errorMessage);
      return new Output(false, [], [errorMessage], null);
    } finally {
      setIsUploadingIcon(false);
    }
  };

  /**
   * Remove o ícone de perfil
   * @param supabaseId - ID do usuário no Supabase
   * @returns Resultado da operação de remoção
   */
  const deleteProfileIcon = async (supabaseId: string): Promise<Output> => {
    setIsUploadingIcon(true);
    setErrors({});

    try {
      const result = await accountService.deleteProfileIcon(supabaseId);

      if (!result.isValid) {
        toast.error(result.errorMessages[0] || "Erro ao remover imagem");
      } else {
        toast.success("Imagem de perfil removida com sucesso!");
      }

      return result;
    } catch (error) {
      console.error("Erro ao remover imagem:", error);
      const errorMessage = "Erro inesperado ao remover imagem";
      toast.error(errorMessage);
      return new Output(false, [], [errorMessage], null);
    } finally {
      setIsUploadingIcon(false);
    }
  };

  /**
   * Atualiza a senha do usuário
   * @param supabaseId - ID do usuário no Supabase
   * @param newPassword - Nova senha
   * @returns Resultado da operação de atualização de senha
   */
  const updatePassword = async (supabaseId: string, newPassword: string): Promise<Output> => {
    setIsLoading(true);
    setErrors({});

    try {
      const result = await accountService.updatePassword(supabaseId, newPassword);

      if (!result.isValid) {
        toast.error(result.errorMessages[0] || "Erro ao atualizar senha");
      } else {
        toast.success("Senha atualizada com sucesso!");
      }

      return result;
    } catch (error) {
      console.error("Erro ao atualizar senha:", error);
      const errorMessage = "Erro inesperado ao atualizar senha";
      toast.error(errorMessage);
      return new Output(false, [], [errorMessage], null);
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Limpa todos os erros do estado
   */
  const clearErrors = () => {
    setErrors({});
  };

  const contextValue: AccountContextState = {
    isLoading,
    isUpdating,
    isUploadingIcon,
    errors,
    updateAccount,
    uploadProfileIcon,
    deleteProfileIcon,
    updatePassword,
    clearErrors,
  };

  return (
    <AccountContext.Provider value={contextValue}>
      {children}
    </AccountContext.Provider>
  );
};

/**
 * Hook personalizado para usar o contexto de conta
 * Garante que o contexto está disponível e fornece acesso tipado ao estado
 */
export const useAccount = (): AccountContextState => {
  const context = useContext(AccountContext);
  
  if (context === undefined) {
    throw new Error("useAccount deve ser usado dentro de um AccountProvider");
  }
  
  return context;
};