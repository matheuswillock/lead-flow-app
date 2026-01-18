"use client";
import React, { createContext, useContext, useState, ReactNode } from "react";
import { RequestToRegisterUserProfile } from "@/app/api/v1/profiles/DTO/requestToRegisterUserProfile";
import { Output } from "@/lib/output";
import { ISignUpService } from "./services/ISignUpService";
import { createSignUpService } from "./services/SignUpService";
import { signUpFormData } from "@/lib/validations/validationForms";

/**
 * Interface para o estado do contexto de cadastro
 */
interface ISignUpContextState {
  isLoading: boolean;
  errors: Record<string, string>;
  registerUser: (data: signUpFormData) => Promise<Output>;
  clearErrors: () => void;
}

/**
 * Propriedades do provider do contexto
*/

interface ISignUpProviderProps {
  children: ReactNode;
  signUpService?: ISignUpService;
}

/**
 * Context para gerenciar o estado de cadastro de usuários
 * Segue o princípio de Dependency Inversion usando a interface do serviço
 */
const SignUpContext = createContext<ISignUpContextState | undefined>(undefined);

/**
 * Provider do contexto de cadastro
 * Gerencia o estado e lógica de negócio relacionada ao cadastro
 */
export const SignUpProvider: React.FC<ISignUpProviderProps> = ({ 
  children, 
  signUpService = createSignUpService()
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  /**
   * Registra um novo usuário
   * @param data - Dados do formulário de cadastro
   * @returns Resultado da operação de cadastro
   */
  const registerUser = async (data: signUpFormData): Promise<Output> => {
    setIsLoading(true);
    setErrors({});

    try {
      // Monta o payload preservando possíveis campos adicionais da assinatura/endereço
      const requestData: RequestToRegisterUserProfile = {
        email: data.email,
        password: data.password,
        fullname: data.fullName,
        phone: data.phone,
        cpfCnpj: data.cpfCnpj, // Campo do formulário
        postalCode: data.postalCode,
        address: data.address,
        addressNumber: data.addressNumber,
        neighborhood: data.neighborhood,
        complement: data.complement,
        city: data.city,
        state: data.state,
        // Campos opcionais (preenchidos quando veio do fluxo de assinatura)
        asaasCustomerId: (data as any).asaasCustomerId,
        subscriptionId: (data as any).subscriptionId,
        subscriptionStatus: (data as any).subscriptionStatus,
        subscriptionPlan: (data as any).subscriptionPlan,
        role: (data as any).role,
        operatorCount: (data as any).operatorCount,
        subscriptionStartDate: (data as any).subscriptionStartDate,
        trialEndDate: (data as any).trialEndDate,
      };

      const result = await signUpService.registerUser(requestData);

      if (result.isValid) { 
        return result;
      } else {
        const apiErrors: Record<string, string> = {};
        
        if (result.errorMessages && result.errorMessages.length > 0) {
          apiErrors.apiError = result.errorMessages.join(", ");
        } else {
          apiErrors.apiError = "Erro ao criar conta. Tente novamente.";
        }
        
        setErrors(apiErrors);
        
        return result        
      }
    } catch (error) {
      console.error("Erro na requisição:", error);
      
      const connectionError = {
        apiError: "Erro de conexão. Verifique sua internet e tente novamente."
      };
      
      setErrors(connectionError);
      
      return new Output(
        false,
        [],
        [connectionError.apiError],
        null
      );
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Limpa os erros do estado
   */
  const clearErrors = () => {
    setErrors({});
  };

  const value: ISignUpContextState = {
    isLoading,
    errors,
    registerUser,
    clearErrors
  };

  return (
    <SignUpContext.Provider value={value}>
      {children}
    </SignUpContext.Provider>
  );
};

/**
 * Hook para usar o contexto de cadastro
 * @returns Estado e funções do contexto de cadastro
 * @throws Error se usado fora do SignUpProvider
 */
export const useSignUp = (): ISignUpContextState => {
  const context = useContext(SignUpContext);
  
  if (context === undefined) {
    throw new Error("useSignUp must be used within a SignUpProvider");
  }
  
  return context;
};