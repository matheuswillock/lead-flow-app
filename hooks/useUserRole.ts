"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/app/context/AuthContext";

// Cache simples para evitar múltiplas requisições
const roleCache: { [key: string]: string } = {};

export function useUserRole() {
  const { user } = useAuth();
  const [role, setRole] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchUserRole = async () => {
      if (!user) {
        setRole(null);
        setLoading(false);
        return;
      }

      // Verifica cache primeiro
      if (roleCache[user.id]) {
        setRole(roleCache[user.id]);
        setLoading(false);
        return;
      }

      try {
        // Buscar o role do usuário na API de profiles
        const response = await fetch(`/api/v1/profiles/${user.id}`);
        
        if (response.ok) {
          const data = await response.json();
          if (data.isValid && data.result) {
            const userRole = data.result.role || "operator";
            roleCache[user.id] = userRole; // Armazenar no cache
            setRole(userRole);
          } else {
            roleCache[user.id] = "operator";
            setRole("operator"); // Default para operator
          }
        } else {
          // Se não conseguir buscar, assume operator por segurança
          roleCache[user.id] = "operator";
          setRole("operator");
        }
      } catch (error) {
        console.error("Erro ao buscar role do usuário:", error);
        roleCache[user.id] = "operator";
        setRole("operator"); // Default para operator em caso de erro
      } finally {
        setLoading(false);
      }
    };

    fetchUserRole();
  }, [user]);

  return { 
    role, 
    loading, 
    isManager: role === "manager",
    isOperator: role === "operator" 
  };
}