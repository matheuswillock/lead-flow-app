"use client";

import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { Output } from "@/lib/output";
import type { UserRole } from "@prisma/client";

/**
 * Interface para os dados do usuário
 */
export interface UserData {
  email: string;
  phone: string | null;
  fullName: string | null;
  role: UserRole;
  managerId: string | null;
}

/**
 * Interface para o estado do contexto do usuário
 */
interface UserContextState {
  user: UserData | null;
  isLoading: boolean;
  error: string | null;
  refreshUser: () => Promise<void>;
  updateUser: (updates: Partial<UserData>) => Promise<Output>;
  updatePassword: (newPassword: string) => Promise<Output>;
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

  /**
   * Busca os dados do usuário da API
   */
  const fetchUser = async (): Promise<void> => {
    if (!supabaseId) {
      setError("Supabase ID is required");
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      const response = await fetch(`/api/v1/profiles/${supabaseId}`);
      const output: Output = await response.json();

      if (output.isValid && output.result) {
        setUser(output.result);
      } else {
        setError(output.errorMessages?.join(", ") || "Failed to load user data");
      }
    } catch (err) {
      console.error("Error fetching user:", err);
      setError("Network error while loading user data");
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Atualiza os dados do usuário
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
        },
        body: JSON.stringify(updates),
      });

      const output: Output = await response.json();

      if (output.isValid && output.result) {
        // Atualiza o estado local com os novos dados
        setUser(output.result);
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
   * Função para recarregar dados do usuário
   */
  const refreshUser = async (): Promise<void> => {
    await fetchUser();
  };

  // Carregar dados do usuário quando o componente monta ou supabaseId muda
  useEffect(() => {
    fetchUser();
  }, [supabaseId]);

  const value: UserContextState = {
    user,
    isLoading,
    error,
    refreshUser,
    updateUser,
    updatePassword,
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