"use client";

import { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";
import { 
  ManagerUser, 
  ManagerUsersState, 
  CreateManagerUserFormData, 
  UpdateManagerUserFormData,
  UserPermissions,
  ManagerUserTableRow 
} from "../types";
import { managerUsersService } from "../services/ManagerUsersService";

interface UseManagerUsersProps {
  supabaseId: string;
  currentUserRole: string;
}

export function useManagerUsers({ supabaseId, currentUserRole }: UseManagerUsersProps) {
  const [state, setState] = useState<ManagerUsersState>({
    users: [],
    loading: true,
    error: null,
    selectedUser: null,
    isCreateModalOpen: false,
    isEditModalOpen: false,
    isDeleteDialogOpen: false,
  });

  const [permissions] = useState<UserPermissions>({
    canCreateUser: currentUserRole === "manager",
    canEditUser: currentUserRole === "manager", 
    canDeleteUser: currentUserRole === "manager",
    canManageOperators: currentUserRole === "manager",
  });

  // Carregar usuários
  const loadUsers = useCallback(async () => {
    try {
      setState(prev => ({ ...prev, loading: true, error: null }));
      
      const response = await managerUsersService.getUsers(supabaseId);
      
      if (response.isValid && response.result) {
        // Buscar contador de leads para cada usuário
        const usersWithLeadsCount = await Promise.all(
          response.result.map(async (user) => {
            const leadsCount = await managerUsersService.getUserLeadsCount(user.id);
            return { ...user, leadsCount };
          })
        );

        setState(prev => ({ 
          ...prev, 
          users: usersWithLeadsCount, 
          loading: false 
        }));
      } else {
        setState(prev => ({ 
          ...prev, 
          error: response.errorMessages.join(", ") || "Erro ao carregar usuários",
          loading: false 
        }));
      }
    } catch (error) {
      console.error("Erro ao carregar usuários:", error);
      setState(prev => ({ 
        ...prev, 
        error: "Erro ao carregar usuários",
        loading: false 
      }));
    }
  }, [supabaseId]);

  // Criar usuário
  const createUser = useCallback(async (userData: CreateManagerUserFormData) => {
    try {
      setState(prev => ({ ...prev, loading: true }));
      
      const response = await managerUsersService.createUser(supabaseId, userData);
      
      if (response.isValid && response.result) {
        toast.success("Usuário criado com sucesso!");
        setState(prev => ({ 
          ...prev, 
          isCreateModalOpen: false,
          loading: false 
        }));
        await loadUsers(); // Recarregar lista
      } else {
        toast.error(response.errorMessages.join(", ") || "Erro ao criar usuário");
        setState(prev => ({ ...prev, loading: false }));
      }
    } catch (error) {
      console.error("Erro ao criar usuário:", error);
      toast.error("Erro ao criar usuário");
      setState(prev => ({ ...prev, loading: false }));
    }
  }, [supabaseId, loadUsers]);

  // Atualizar usuário
  const updateUser = useCallback(async (userId: string, userData: UpdateManagerUserFormData) => {
    try {
      setState(prev => ({ ...prev, loading: true }));
      
      const response = await managerUsersService.updateUser(supabaseId, userId, userData);
      
      if (response.isValid && response.result) {
        toast.success("Usuário atualizado com sucesso!");
        setState(prev => ({ 
          ...prev, 
          isEditModalOpen: false,
          selectedUser: null,
          loading: false 
        }));
        await loadUsers(); // Recarregar lista
      } else {
        toast.error(response.errorMessages.join(", ") || "Erro ao atualizar usuário");
        setState(prev => ({ ...prev, loading: false }));
      }
    } catch (error) {
      console.error("Erro ao atualizar usuário:", error);
      toast.error("Erro ao atualizar usuário");
      setState(prev => ({ ...prev, loading: false }));
    }
  }, [supabaseId, loadUsers]);

  // Deletar usuário
  const deleteUser = useCallback(async (userId: string) => {
    try {
      setState(prev => ({ ...prev, loading: true }));
      
      // Verificar se pode deletar
      const canDelete = await managerUsersService.canDeleteUser(supabaseId, userId);
      
      if (!canDelete) {
        toast.error("Não é possível deletar este usuário");
        setState(prev => ({ ...prev, loading: false }));
        return;
      }
      
      const response = await managerUsersService.deleteUser(supabaseId, userId);
      
      if (response.isValid) {
        toast.success("Usuário removido com sucesso!");
        setState(prev => ({ 
          ...prev, 
          isDeleteDialogOpen: false,
          selectedUser: null,
          loading: false 
        }));
        await loadUsers(); // Recarregar lista
      } else {
        toast.error(response.errorMessages.join(", ") || "Erro ao remover usuário");
        setState(prev => ({ ...prev, loading: false }));
      }
    } catch (error) {
      console.error("Erro ao deletar usuário:", error);
      toast.error("Erro ao remover usuário");
      setState(prev => ({ ...prev, loading: false }));
    }
  }, [supabaseId, loadUsers]);

  // Preparar dados da tabela com permissões
  const tableData: ManagerUserTableRow[] = state.users.map(user => ({
    ...user,
    canEdit: permissions.canEditUser && managerUsersService.canEditUser(supabaseId, user.id, user.role),
    canDelete: permissions.canDeleteUser && (user.id !== supabaseId), // Não pode deletar a si mesmo
  }));

  // Ações de UI
  const openCreateModal = useCallback(() => {
    setState(prev => ({ ...prev, isCreateModalOpen: true }));
  }, []);

  const closeCreateModal = useCallback(() => {
    setState(prev => ({ ...prev, isCreateModalOpen: false }));
  }, []);

  const openEditModal = useCallback((user: ManagerUser) => {
    setState(prev => ({ 
      ...prev, 
      selectedUser: user, 
      isEditModalOpen: true 
    }));
  }, []);

  const closeEditModal = useCallback(() => {
    setState(prev => ({ 
      ...prev, 
      isEditModalOpen: false, 
      selectedUser: null 
    }));
  }, []);

  const openDeleteDialog = useCallback((user: ManagerUser) => {
    setState(prev => ({ 
      ...prev, 
      selectedUser: user, 
      isDeleteDialogOpen: true 
    }));
  }, []);

  const closeDeleteDialog = useCallback(() => {
    setState(prev => ({ 
      ...prev, 
      isDeleteDialogOpen: false, 
      selectedUser: null 
    }));
  }, []);

  // Carregar dados no mount
  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  return {
    // Estado
    ...state,
    tableData,
    permissions,
    
    // Ações
    loadUsers,
    createUser,
    updateUser,
    deleteUser,
    
    // Controle de UI
    openCreateModal,
    closeCreateModal,
    openEditModal,
    closeEditModal,
    openDeleteDialog,
    closeDeleteDialog,
  };
}