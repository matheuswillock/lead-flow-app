"use client";
import React, { createContext, useContext, useState, ReactNode } from "react";
import { RequestToRegisterUserProfile } from "@/app/api/v1/profiles/DTO/requestToRegisterUserProfile";
import { Output } from "@/lib/output";
import { ISignUpService } from "./services/ISignUpService";
import { createSignUpService } from "./services/SignUpService";
import { signUpFormData, signUpOAuthFormData } from "@/lib/validations/validationForms";
import { createSupabaseBrowser } from "@/lib/supabase/browser";

/**
 * Método de pagamento selecionado
 */
export type PaymentMethod = 'CREDIT_CARD' | 'PIX' | 'BOLETO';

/**
 * Etapa do fluxo de cadastro
 */
export type SignUpStep = 'form' | 'payment';

/**
 * Interface para o estado do contexto de cadastro
 */
interface ISignUpContextState {
  isLoading: boolean;
  errors: Record<string, string>;
  currentStep: SignUpStep;
  paymentMethod: PaymentMethod | null;
  createdUserData: {
    supabaseId: string;
    fullName: string;
    email: string;
    phone: string;
    cpfCnpj: string;
    postalCode?: string;
    address?: string;
    addressNumber?: string;
    neighborhood?: string;
    complement?: string;
    city?: string;
    state?: string;
  } | null;
  registerUser: (data: signUpFormData | signUpOAuthFormData, options?: { isOAuth?: boolean }) => Promise<Output>;
  setPaymentMethod: (method: PaymentMethod) => void;
  proceedToCheckout: (method?: PaymentMethod) => Promise<void>;
  goBackToForm: () => void;
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
  const [currentStep, setCurrentStep] = useState<SignUpStep>('form');
  const [paymentMethod, setPaymentMethodState] = useState<PaymentMethod | null>(null);
  const [createdUserData, setCreatedUserData] = useState<{
    supabaseId: string;
    fullName: string;
    email: string;
    phone: string;
    cpfCnpj: string;
    postalCode?: string;
    address?: string;
    addressNumber?: string;
    neighborhood?: string;
    complement?: string;
    city?: string;
    state?: string;
  } | null>(null);

  /**
   * Registra um novo usuário
   * @param data - Dados do formulário de cadastro
   * @returns Resultado da operação de cadastro
   */
  const registerUser = async (data: signUpFormData | signUpOAuthFormData, options?: { isOAuth?: boolean }): Promise<Output> => {
    setIsLoading(true);
    setErrors({});

    try {
      console.info('🔍 [SignUpContext] Dados recebidos:', {
        neighborhood: data.neighborhood,
        postalCode: data.postalCode,
        address: data.address,
        city: data.city,
        state: data.state,
      });
      
      // Monta o payload preservando possíveis campos adicionais da assinatura/endereço
      let result: Output;

      if (options?.isOAuth) {
        const supabase = createSupabaseBrowser();
        if (!supabase) {
          return new Output(false, [], ["Supabase indisponível"], null);
        }

        const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
        if (sessionError || !sessionData.session?.user) {
          return new Output(false, [], ["Sessão inválida. Faça login novamente."], null);
        }

        const supabaseId = sessionData.session.user.id;

        const requestData = {
          email: data.email,
          fullname: data.fullName,
          phone: data.phone,
          cpfCnpj: data.cpfCnpj,
          postalCode: data.postalCode,
          address: data.address,
          addressNumber: data.addressNumber,
          neighborhood: data.neighborhood,
          complement: data.complement,
          city: data.city,
          state: data.state,
          asaasCustomerId: (data as any).asaasCustomerId,
          subscriptionId: (data as any).subscriptionId,
          subscriptionStatus: (data as any).subscriptionStatus,
          subscriptionPlan: (data as any).subscriptionPlan,
          role: (data as any).role,
          operatorCount: (data as any).operatorCount,
          subscriptionStartDate: (data as any).subscriptionStartDate,
          trialEndDate: (data as any).trialEndDate,
        };

        console.info('📤 [SignUpContext] Enviando OAuth para API:', {
          neighborhood: requestData.neighborhood,
          postalCode: requestData.postalCode,
          address: requestData.address,
          city: requestData.city,
          state: requestData.state,
        });

        result = await signUpService.registerUserOAuth(requestData, supabaseId);
      } else {
        const formData = data as signUpFormData;
        const requestData: RequestToRegisterUserProfile = {
          email: formData.email,
          password: formData.password,
          fullname: formData.fullName,
          phone: formData.phone,
          cpfCnpj: formData.cpfCnpj, // Campo do formulário
          postalCode: formData.postalCode,
          address: formData.address,
          addressNumber: formData.addressNumber,
          neighborhood: formData.neighborhood,
          complement: formData.complement,
          city: formData.city,
          state: formData.state,
          // Campos opcionais (preenchidos quando veio do fluxo de assinatura)
          asaasCustomerId: (formData as any).asaasCustomerId,
          subscriptionId: (formData as any).subscriptionId,
          subscriptionStatus: (formData as any).subscriptionStatus,
          subscriptionPlan: (formData as any).subscriptionPlan,
          role: (formData as any).role,
          operatorCount: (formData as any).operatorCount,
          subscriptionStartDate: (formData as any).subscriptionStartDate,
          trialEndDate: (formData as any).trialEndDate,
        };
        
        console.info('📤 [SignUpContext] Enviando para API:', {
          neighborhood: requestData.neighborhood,
          postalCode: requestData.postalCode,
          address: requestData.address,
          city: requestData.city,
          state: requestData.state,
        });

        result = await signUpService.registerUser(requestData);
      }

      if (result.isValid) {
        // Armazenar dados do usuário criado
        setCreatedUserData({
          supabaseId: result.result.supabaseId,
          fullName: data.fullName,
          email: data.email,
          phone: data.phone,
          cpfCnpj: data.cpfCnpj,
          postalCode: data.postalCode,
          address: data.address,
          addressNumber: data.addressNumber,
          neighborhood: data.neighborhood,
          complement: data.complement,
          city: data.city,
          state: data.state,
        });
        
        // Mudar para etapa de seleção de pagamento
        setCurrentStep('payment');
        
        if (options?.isOAuth) {
          const pending = sessionStorage.getItem("googleConnectPending");
          if (pending) {
            try {
              const payload = JSON.parse(pending) as {
                accessToken?: string;
                refreshToken?: string;
                expiresAt?: string;
                email?: string;
              };

              await fetch("/api/v1/google/connect", {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  "x-supabase-user-id": result.result.supabaseId,
                },
                body: JSON.stringify({
                  accessToken: payload.accessToken,
                  refreshToken: payload.refreshToken || undefined,
                  expiresAt: payload.expiresAt,
                  email: payload.email,
                }),
              });
            } catch (error) {
              console.warn("Falha ao conectar Google apos cadastro:", error);
            } finally {
              sessionStorage.removeItem("googleConnectPending");
            }
          }
        }

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
   * Define o método de pagamento selecionado
   */
  const setPaymentMethod = (method: PaymentMethod) => {
    setPaymentMethodState(method);
  };

  /**
   * Prossegue para o checkout com o método selecionado
   */
  const proceedToCheckout = async (method?: PaymentMethod) => {
    const selectedMethod = method || paymentMethod;
    
    if (!createdUserData || !selectedMethod) {
      console.error('❌ [SignUpContext] Dados incompletos para checkout', {
        hasUserData: !!createdUserData,
        hasMethod: !!selectedMethod
      });
      return;
    }

    setIsLoading(true);

    try {
      console.info('💳 [SignUpContext] Criando checkout:', { paymentMethod: selectedMethod });

      const checkoutResponse = await fetch('/api/v1/checkout/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          supabaseId: createdUserData.supabaseId,
          fullName: createdUserData.fullName,
          email: createdUserData.email,
          phone: createdUserData.phone,
          cpfCnpj: createdUserData.cpfCnpj,
          billingType: selectedMethod,
        }),
      });

      const checkoutResult = await checkoutResponse.json();

      if (checkoutResult.isValid && checkoutResult.result?.checkoutUrl) {
        console.info('✅ [SignUpContext] Redirecionando para checkout');
        
        // Redirecionar para checkout Asaas
        window.location.href = checkoutResult.result.checkoutUrl;
      } else {
        console.error('❌ [SignUpContext] Erro ao criar checkout:', checkoutResult.errorMessages);
        setErrors({
          checkout: checkoutResult.errorMessages?.join(', ') || 'Erro ao criar checkout',
        });
      }
    } catch (error) {
      console.error('❌ [SignUpContext] Erro ao criar checkout:', error);
      setErrors({
        checkout: 'Erro ao processar pagamento. Tente novamente.',
      });
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Volta para o formulário de cadastro
   */
  const goBackToForm = () => {
    setCurrentStep('form');
    setPaymentMethodState(null);
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
    currentStep,
    paymentMethod,
    createdUserData,
    registerUser,
    setPaymentMethod,
    proceedToCheckout,
    goBackToForm,
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
