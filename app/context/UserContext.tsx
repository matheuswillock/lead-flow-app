"use client";

import { createContext, useContext, useState, useEffect, ReactNode, useCallback, useRef } from "react";
import { Output } from "@/lib/output";
import type { UserRole, UserFunction } from "@prisma/client";
import type { UserAssociated } from "@/app/api/v1/profiles/DTO/profileResponseDTO";

type UserBootstrapResponse = {
  profileOutput: Output;
  subscriptionCheckResult: {
    userExists?: boolean;
    hasActiveSubscription?: boolean;
    userRole?: string | null;
  } | null;
};

const userBootstrapInFlight = new Map<string, Promise<UserBootstrapResponse>>();

/**
 * Interface para os dados do usuário
 */
export interface UserData {
  id: string;
  email: string;
  supabaseId: string | null;
  fullName: string | null;
  phone: string | null;
  cpfCnpj: string | null;
  postalCode: string | null;
  address: string | null;
  addressNumber: string | null;
  neighborhood: string | null;
  complement: string | null;
  city: string | null;
  state: string | null;
  profileIconId: string | null;
  profileIconUrl: string | null;
  googleCalendarConnected: boolean;
  googleEmail: string | null;
  role: UserRole;
  functions: UserFunction[];
  isMaster: boolean;
  hasPermanentSubscription: boolean;
  managerId: string | null;
  subscriptionStatus: string | null;
  subscriptionId: string | null;
  activeTeamId: string | null;
  usersAssociated: UserAssociated[];
  createdAt: string;
  updatedAt: string;
}

/**
 * Estado do contexto de usuário
 */
interface UserContextState {
  user: UserData | null;
  isLoading: boolean;
  error: string | null;
  hasActiveSubscription: boolean;
  userRole: string | null; // 'master', 'manager', 'backoffice', 'operator'
  refreshUser: () => Promise<void>;
  updateUser: (updates: Partial<UserData>) => Promise<Output>;
  updatePassword: (newPassword: string) => Promise<Output>;
  uploadProfileIcon: (file: File) => Promise<Output>;
  deleteProfileIcon: () => Promise<Output>;
}

/**
 * Props do provider do contexto
 */
interface UserProviderProps {
  children: ReactNode;
  supabaseId: string;
}

/**
 * Context para gerenciar os dados do usuário
 */
const UserContext = createContext<UserContextState | undefined>(undefined);

/**
 * Provider do contexto de usuário
 * Gerencia o estado e operações relacionadas aos dados do usuário
 */
export const UserProvider: React.FC<UserProviderProps> = ({ 
  children, 
  supabaseId
}) => {
  const [user, setUser] = useState<UserData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hasActiveSubscription, setHasActiveSubscription] = useState(false);
  const [userRole, setUserRole] = useState<string | null>(null);
  const lastLoadedSupabaseIdRef = useRef<string | null>(null);

  /**
   * Busca dados do usuário na API
   */
  const fetchUser = useCallback(async (options?: { force?: boolean }): Promise<void> => {
    const force = options?.force ?? false;

    if (!supabaseId) {
      return;
    }

    if (!force && lastLoadedSupabaseIdRef.current === supabaseId) {
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      const createBootstrapRequest = async (): Promise<UserBootstrapResponse> => {
        const response = await fetch(`/api/v1/profiles/${supabaseId}`);
        const profileOutput: Output = await response.json();

        if (!profileOutput.isValid || !profileOutput.result) {
          return {
            profileOutput,
            subscriptionCheckResult: null,
          };
        }

        const checkResponse = await fetch('/api/v1/subscriptions/check', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            email: profileOutput.result.email,
            phone: profileOutput.result.phone,
            cpfCnpj: profileOutput.result.cpfCnpj,
          }),
        });

        const subscriptionCheckOutput: Output = await checkResponse.json();
        const subscriptionCheckResult = subscriptionCheckOutput.isValid
          ? (subscriptionCheckOutput.result as UserBootstrapResponse["subscriptionCheckResult"])
          : null;

        return {
          profileOutput,
          subscriptionCheckResult,
        };
      };

      let requestPromise: Promise<UserBootstrapResponse>;
      if (force) {
        requestPromise = createBootstrapRequest();
      } else {
        const existingPromise = userBootstrapInFlight.get(supabaseId);
        if (existingPromise) {
          requestPromise = existingPromise;
        } else {
          requestPromise = createBootstrapRequest().finally(() => {
            userBootstrapInFlight.delete(supabaseId);
          });
          userBootstrapInFlight.set(supabaseId, requestPromise);
        }
      }

      const { profileOutput, subscriptionCheckResult } = await requestPromise;
      
      if (profileOutput.isValid && profileOutput.result) {
        setUser(profileOutput.result);
        lastLoadedSupabaseIdRef.current = supabaseId;
        
        // Usar o SubscriptionCheckService para validar assinatura
        // Ele já implementa a lógica master/operator
        console.info('🔍 [UserContext] Verificando assinatura via SubscriptionCheckService');

        if (subscriptionCheckResult?.userExists) {
          setHasActiveSubscription(!!subscriptionCheckResult.hasActiveSubscription);
          setUserRole(subscriptionCheckResult.userRole || null);
          
          console.info('✅ [UserContext] Verificação de assinatura concluída:', {
            hasActiveSubscription: subscriptionCheckResult.hasActiveSubscription,
            userRole: subscriptionCheckResult.userRole,
          });
        } else {
          setHasActiveSubscription(false);
          setUserRole(null);
          console.warn('⚠️ [UserContext] Usuário não encontrado no check de assinatura');
        }
      } else {
        setUser(null);
        setHasActiveSubscription(false);
        setUserRole(null);
        setError(profileOutput.errorMessages?.join(", ") || "Failed to fetch user data");
      }
    } catch (err) {
      console.error("Error fetching user:", err);
      setError("Network error while fetching user data");
    } finally {
      setIsLoading(false);
    }
  }, [supabaseId]);

  /**
   * Atualiza dados do usuário
   */
  const updateUser = async (updates: Partial<UserData>): Promise<Output> => {
    if (!supabaseId) {
      return new Output(false, [], ["Supabase ID is required"], null);
    }

    try {
      setIsLoading(true);
      setError(null);

      const response = await fetch(`/api/v1/profiles/${supabaseId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "x-origin-screen": "account-settings",
        },
        body: JSON.stringify(updates),
      });

      const output: Output = await response.json();

      if (output.isValid && output.result) {
        // Atualiza o estado local com os novos dados sem perder campos existentes
        setUser((prev) => (prev ? { ...prev, ...output.result } : output.result));
        if (updates.functions !== undefined) {
          await fetchUser({ force: true });
        }
      } else {
        setError(output.errorMessages?.join(", ") || "Failed to update user");
      }

      return output;
    } catch (err) {
      console.error("Error updating user:", err);
      const error = "Network error while updating user";
      setError(error);
      return new Output(false, [], [error], null);
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Atualiza a senha do usuário
   */
  const updatePassword = async (newPassword: string): Promise<Output> => {
    if (!supabaseId) {
      return new Output(false, [], ["Supabase ID is required"], null);
    }

    try {
      setIsLoading(true);
      setError(null);

      const response = await fetch(`/api/v1/profiles/${supabaseId}/password`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "x-origin-screen": "account-settings",
        },
        body: JSON.stringify({ password: newPassword }),
      });

      const output: Output = await response.json();

      if (!output.isValid) {
        setError(output.errorMessages?.join(", ") || "Failed to update password");
      }

      return output;
    } catch (err) {
      console.error("Error updating password:", err);
      const error = "Network error while updating password";
      setError(error);
      return new Output(false, [], [error], null);
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Faz upload do ícone de perfil
   */
  const uploadProfileIcon = async (file: File): Promise<Output> => {
    if (!supabaseId) {
      return new Output(false, [], ["Supabase ID is required"], null);
    }

    try {
      setIsLoading(true);
      setError(null);

      const formData = new FormData();
      formData.append('icon', file);

      const response = await fetch(`/api/v1/profiles/${supabaseId}/icon`, {
        method: "POST",
        body: formData,
      });

      const output: Output = await response.json();

      if (output.isValid) {
        // Recarregar dados do usuário para obter o novo profileIconId
        await fetchUser({ force: true });
      } else {
        setError(output.errorMessages?.join(", ") || "Failed to upload profile icon");
      }

      return output;
    } catch (err) {
      console.error("Error uploading profile icon:", err);
      const error = "Network error while uploading profile icon";
      setError(error);
      return new Output(false, [], [error], null);
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Remove o ícone de perfil
   */
  const deleteProfileIcon = async (): Promise<Output> => {
    if (!supabaseId) {
      return new Output(false, [], ["Supabase ID is required"], null);
    }

    try {
      setIsLoading(true);
      setError(null);

      const response = await fetch(`/api/v1/profiles/${supabaseId}/icon`, {
        method: "DELETE",
      });

      const output: Output = await response.json();

      if (output.isValid) {
        // Recarregar dados do usuário para remover o profileIconId
        await fetchUser({ force: true });
      } else {
        setError(output.errorMessages?.join(", ") || "Failed to delete profile icon");
      }

      return output;
    } catch (err) {
      console.error("Error deleting profile icon:", err);
      const error = "Network error while deleting profile icon";
      setError(error);
      return new Output(false, [], [error], null);
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Função para recarregar dados do usuário
   */
  const refreshUser = async (): Promise<void> => {
    await fetchUser({ force: true });
  };

  // Carregar dados do usuário quando o componente monta ou supabaseId muda
  useEffect(() => {
    void fetchUser();
  }, [fetchUser]);

  const value: UserContextState = {
    user,
    isLoading,
    error,
    hasActiveSubscription,
    userRole,
    refreshUser,
    updateUser,
    updatePassword,
    uploadProfileIcon,
    deleteProfileIcon,
  };

  return (
    <UserContext.Provider value={value}>
      {children}
    </UserContext.Provider>
  );
};

/**
 * Hook para usar o contexto de usuário
 * @returns Estado e funções do contexto de usuário
 * @throws Error se usado fora do UserProvider
 */
export const useUser = (): UserContextState => {
  const context = useContext(UserContext);
  
  if (context === undefined) {
    throw new Error("useUser must be used within a UserProvider");
  }
  
  return context;
};

/**
 * Alias for useUser hook (backward compatibility)
 */
export const useUserContext = useUser;
