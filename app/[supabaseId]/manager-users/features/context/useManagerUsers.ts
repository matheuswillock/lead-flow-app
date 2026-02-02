"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { toast } from "sonner";
import { 
  ManagerUser, 
  ManagerUsersState, 
  CreateManagerUserFormData, 
  UpdateManagerUserFormData,
  UserPermissions,
  ManagerUserTableRow
} from "../types";
import { ManagerUsersService } from "../services/ManagerUsersService";
import { useTeamContext } from "@/app/context/TeamContext";

interface UseManagerUsersProps {
  supabaseId: string;
  currentUserRole: string;
  currentProfileId?: string;
  hasPermanentSubscription?: boolean;
}

export function useManagerUsers({ supabaseId, currentUserRole, currentProfileId, hasPermanentSubscription = false }: UseManagerUsersProps) {
  const { activeTeamId, activeRole } = useTeamContext();
  const [state, setState] = useState<ManagerUsersState>({
    users: [],
    loading: true,
    error: null,
    selectedUser: null,
    isCreateModalOpen: false,
    isEditModalOpen: false,
    isDeleteDialogOpen: false,
  });
  const [operatorCheckout, setOperatorCheckout] = useState<{
    isOpen: boolean;
    operatorData: CreateManagerUserFormData | null;
  }>({
    isOpen: false,
    operatorData: null,
  });


  const resolvedRole = activeRole ?? currentUserRole;
  const permissions = useMemo<UserPermissions>(() => ({
    canCreateUser: resolvedRole === "manager",
    canEditUser: resolvedRole === "manager",
    canDeleteUser: resolvedRole === "manager",
    canManageOperators: resolvedRole === "manager",
  }), [resolvedRole]);

  // Criar instância do serviço com o supabaseId
  const managerUsersService = useMemo(() => {
    return new ManagerUsersService(supabaseId, activeTeamId);
  }, [supabaseId, activeTeamId]);

  // Carregar usuários
  const loadUsers = useCallback(async () => {
    try {
      if (!activeTeamId) {
        setState(prev => ({ ...prev, users: [], loading: false, error: "Selecione um time para continuar." }));
        return;
      }

      setState(prev => ({ ...prev, loading: true, error: null }));
      
      const response = await managerUsersService.getUsers();
      
      if (response.isValid && response.result) {
        // A API já retorna leadsCount para cada usuário, usar diretamente
        setState(prev => ({ 
          ...prev, 
          users: response.result || [], 
          stats: response.stats,
          loading: false 
        }));
      } else {
        setState(prev => ({ 
          ...prev, 
          users: [],
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
  }, [managerUsersService, activeTeamId]);

  // Criar usuário - se tem assinatura permanente, cria direto; senão redireciona para checkout do Asaas
  const createUser = useCallback(async (userData: CreateManagerUserFormData) => {
    try {
      setState(prev => ({ ...prev, loading: true }));

      const normalizedEmail = userData.email.trim().toLowerCase();
      const emailInList = state.users.some(user => user.email?.toLowerCase() === normalizedEmail);
      if (emailInList) {
        toast.error("Email já está em uso");
        setState(prev => ({ ...prev, loading: false, isCreateModalOpen: true }));
        return;
      }
      
      const emailCheck = await managerUsersService.checkEmailAvailability(userData.email);
      if (!emailCheck.available) {
        toast.error(emailCheck.error || "Email já está em uso");
        setState(prev => ({ ...prev, loading: false, isCreateModalOpen: true }));
        return;
      }

      // Se tem assinatura permanente, criar diretamente sem passar pelo Asaas
      if (hasPermanentSubscription) {
        toast.loading("Criando usuário...");

        console.info('🎯 [createUser] Criando usuário com assinatura permanente', {
          supabaseId,
          userData,
        });

        const response = await fetch(`/api/v1/manager/${supabaseId}/users`, {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'x-supabase-user-id': supabaseId,
            ...(activeTeamId ? { 'x-team-id': activeTeamId } : {}),
          },
          body: JSON.stringify({
            name: userData.name,
            email: userData.email,
            role: userData.role || 'operator',
            functions: userData.functions,
            hasPermanentSubscription: true, // Herda assinatura permanente
          }),
        });

        const result = await response.json();

        toast.dismiss();

        if (result.isValid) {
          toast.success("Usuário criado com sucesso!", {
            description: 'Um email de convite foi enviado para o novo usuário.',
            duration: 5000,
          });
          setState(prev => ({ ...prev, isCreateModalOpen: false }));
          setState(prev => ({ ...prev, loading: false }));
          await loadUsers(); // Recarregar lista
        } else {
          toast.error(result.errorMessages?.join(', ') || 'Erro ao criar usuário');
          setState(prev => ({ ...prev, loading: false }));
        }
        return;
      }
      // Fechar modal e abrir checkout
      setState(prev => ({ ...prev, isCreateModalOpen: false }));
      if (!activeTeamId) {
        toast.error("Selecione um time para continuar");
        setState(prev => ({ ...prev, loading: false }));
        return;
      }
      // Fluxo normal: abrir checkout interno para pagamento do operador
      setOperatorCheckout({
        isOpen: true,
        operatorData: userData,
      });
      setState(prev => ({ ...prev, loading: false }));
    } catch (error) {
      console.error("Erro ao criar usuário:", error);
      toast.error("Erro ao criar usuário");
      setState(prev => ({ ...prev, loading: false }));
    }
  }, [supabaseId, hasPermanentSubscription, loadUsers, managerUsersService, state.users, activeTeamId]);

  // Atualizar usuário
  const updateUser = useCallback(async (userId: string, userData: UpdateManagerUserFormData) => {
    try {
      setState(prev => ({ ...prev, loading: true }));
      
      const response = await managerUsersService.updateUser(userId, userData);
      
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
  }, [managerUsersService, loadUsers]);

  // Deletar usuário
  const deleteUser = useCallback(async (userId: string) => {
    try {
      setState(prev => ({ ...prev, loading: true }));
      
      // Verificar se pode deletar
      const canDelete = await managerUsersService.canDeleteUser(userId);
      
      if (!canDelete) {
        toast.error("Não é possível deletar este usuário");
        setState(prev => ({ ...prev, loading: false }));
        return;
      }
      
      const response = await managerUsersService.deleteUser(userId);
      
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
  const resolvedProfileId = currentProfileId ?? supabaseId;
  const tableData: ManagerUserTableRow[] = state.users.map(user => {
    // Determinar status baseado em isPending e pendingPayment
    let status: ManagerUserTableRow['status'] = 'active';
    
    if (user.isPending && user.pendingPayment) {
      const { paymentStatus, operatorCreated } = user.pendingPayment;
      
      if (paymentStatus === 'PENDING') {
        status = 'pending_payment';
      } else if (paymentStatus === 'CONFIRMED' && !operatorCreated) {
        status = 'pending_creation';
      } else if (paymentStatus === 'CONFIRMED' && operatorCreated) {
        status = 'payment_confirmed';
      } else if (paymentStatus === 'FAILED') {
        status = 'payment_failed';
      }
    }
    
    return {
      ...user,
      canEdit: permissions.canEditUser && managerUsersService.canEditUser(resolvedProfileId, user.id, user.role) && !user.isPending,
      canDelete: permissions.canDeleteUser && (user.id !== resolvedProfileId) && !user.isPending,
      status,
      pendingPayment: user.pendingPayment ? {
        id: user.pendingPayment.id,
        managerId: user.managerId || supabaseId,
        name: user.name,
        email: user.email,
        role: user.role,
        paymentId: user.pendingPayment.paymentId,
        paymentStatus: user.pendingPayment.paymentStatus,
        paymentMethod: user.pendingPayment.paymentMethod,
        operatorCreated: user.pendingPayment.operatorCreated,
        operatorId: user.id,
        createdAt: typeof user.createdAt === 'string' ? user.createdAt : user.createdAt.toISOString(),
        updatedAt: typeof user.updatedAt === 'string' ? user.updatedAt : user.updatedAt.toISOString(),
      } : undefined
    };
  });

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

  const closeOperatorCheckout = useCallback(() => {
    setOperatorCheckout({ isOpen: false, operatorData: null });
  }, []);

  const completeOperatorCheckout = useCallback(async () => {
    setOperatorCheckout({ isOpen: false, operatorData: null });
    await loadUsers();
  }, [loadUsers]);

  // Carregar dados no mount
  useEffect(() => {
    loadUsers();
    
    // Verificar se retornou do checkout com sucesso
    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search);
      const paymentSuccess = urlParams.get('payment');
      const operatorId = urlParams.get('operatorId');
      
      if (paymentSuccess === 'success' && operatorId) {
        toast.success('Pagamento em processamento! O operador será ativado após confirmação.', {
          description: 'Você pode acompanhar o status na tabela abaixo.',
          duration: 5000,
        });
        
        // Limpar parâmetros da URL
        const cleanUrl = window.location.pathname;
        window.history.replaceState({}, '', cleanUrl);
      }
    }
  }, [loadUsers]);

  // Auto-refresh a cada 10 segundos se houver operadores pendentes
  useEffect(() => {
    const hasPendingOperators = state.users.some(user => user.isPending);
    
    if (!hasPendingOperators) return;
    
    const intervalId = setInterval(() => {
      console.info('🔄 Auto-refresh: Verificando status de operadores pendentes...');
      loadUsers();
    }, 10000); // 10 segundos
    
    return () => clearInterval(intervalId);
  }, [state.users, loadUsers]);

  // Auto-refresh a cada 10 segundos se houver operadores pendentes
  useEffect(() => {
    const hasPendingOperators = state.users.some(user => user.isPending);
    
    if (!hasPendingOperators) return;
    
    const intervalId = setInterval(() => {
      console.info('🔄 Auto-refresh: Verificando status de operadores pendentes...');
      loadUsers();
    }, 10000); // 10 segundos
    
    return () => clearInterval(intervalId);
  }, [state.users, loadUsers]);

  // Reenviar convite por e-mail
  const resendInvite = useCallback(async (email: string, userId?: string) => {
    const toastId = toast.loading('Enviando email de reset de senha...');
    
    try {
      const result = await managerUsersService.resendInvite(email, userId);
      
      toast.dismiss(toastId);
      
      if (result.isValid) {
        toast.success('Email de reset de senha enviado com sucesso!');
      } else {
        toast.error(result.errorMessages.join(', ') || 'Erro ao enviar email');
      }
    } catch (error) {
      toast.dismiss(toastId);
      console.error('Erro ao enviar email de reset:', error);
      toast.error('Erro ao enviar email');
    }
  }, [managerUsersService]);

  // Alternar assinatura permanente
  const togglePermanentSubscription = useCallback(async (userId: string, currentValue: boolean) => {
    try {
      const newValue = !currentValue;
      const action = newValue ? 'ativar' : 'desativar';
      
      toast.loading(`${action === 'ativar' ? 'Ativando' : 'Desativando'} assinatura permanente...`);

      const response = await fetch(`/api/v1/profiles/${userId}/permanent-subscription`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hasPermanentSubscription: newValue })
      });

      const result = await response.json();

      if (result.isValid) {
        toast.success(`Assinatura permanente ${newValue ? 'ativada' : 'desativada'} com sucesso!`);
        // Recarregar usuários
        await loadUsers();
      } else {
        toast.error(result.errorMessages.join(', ') || `Erro ao ${action} assinatura permanente`);
      }
    } catch (error) {
      console.error('Erro ao alternar assinatura permanente:', error);
      toast.error('Erro ao alterar assinatura permanente');
    }
  }, [loadUsers]);

  return {
    // Estado
    ...state,
    tableData,
    permissions,
    
    // Ações
    loadUsers,
    refreshData: loadUsers, // Alias para loadUsers
    createUser,
    updateUser,
    deleteUser,
    resendInvite,
    togglePermanentSubscription,
    operatorCheckout,
    closeOperatorCheckout,
    completeOperatorCheckout,
    
    // Controle de UI
    openCreateModal,
    closeCreateModal,
    openEditModal,
    closeEditModal,
    openDeleteDialog,
    closeDeleteDialog,
  };
}
