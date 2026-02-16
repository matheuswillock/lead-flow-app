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
import { notifyManagerUsersError } from "../utils/managerUsersErrors";

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
  const errorContext = useMemo(() => ({
    supabaseId,
    teamId: activeTeamId ?? undefined,
    userId: currentProfileId ?? supabaseId,
  }), [supabaseId, activeTeamId, currentProfileId]);

  // Carregar usuários
  const loadUsers = useCallback(async () => {
    try {
      if (!activeTeamId) {
        const message = notifyManagerUsersError({
          operation: "loadUsers",
          errorMessages: ["Selecione um time para continuar."],
          context: errorContext,
        });
        setState(prev => ({ ...prev, users: [], loading: false, error: message }));
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
        const message = notifyManagerUsersError({
          operation: "loadUsers",
          errorMessages: response.errorMessages,
          context: errorContext,
        });
        setState(prev => ({ 
          ...prev, 
          users: [],
          error: message,
          loading: false 
        }));
      }
    } catch (error) {
      console.error("Erro ao carregar usuários:", error);
      const message = notifyManagerUsersError({
        operation: "loadUsers",
        error,
        context: errorContext,
      });
      setState(prev => ({ 
        ...prev, 
        error: message,
        loading: false 
      }));
    }
  }, [managerUsersService, activeTeamId, errorContext]);

  // Criar usuário - se tem assinatura permanente, cria direto; senão redireciona para checkout do Asaas
  const createUser = useCallback(async (userData: CreateManagerUserFormData) => {
    try {
      setState(prev => ({ ...prev, loading: true }));

      const normalizedEmail = userData.email.trim().toLowerCase();
      const emailInList = state.users.some(user => user.email?.toLowerCase() === normalizedEmail);
      if (emailInList) {
        notifyManagerUsersError({
          operation: "checkEmail",
          errorMessages: ["Email já está em uso"],
          context: errorContext,
        });
        setState(prev => ({ ...prev, loading: false, isCreateModalOpen: true }));
        return;
      }
      
      const emailCheck = await managerUsersService.checkEmailAvailability(userData.email);
      if (!emailCheck.available) {
        notifyManagerUsersError({
          operation: "checkEmail",
          errorMessages: [emailCheck.error || "Email já está em uso"],
          context: errorContext,
        });
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
          notifyManagerUsersError({
            operation: "createUser",
            errorMessages: result.errorMessages,
            context: errorContext,
          });
          setState(prev => ({ ...prev, loading: false }));
        }
        return;
      }
      // Fechar modal e abrir checkout
      setState(prev => ({ ...prev, isCreateModalOpen: false }));
      if (!activeTeamId) {
        notifyManagerUsersError({
          operation: "createUser",
          errorMessages: ["Selecione um time para continuar"],
          context: errorContext,
        });
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
      toast.dismiss();
      notifyManagerUsersError({
        operation: "createUser",
        error,
        context: errorContext,
      });
      setState(prev => ({ ...prev, loading: false }));
    }
  }, [supabaseId, hasPermanentSubscription, loadUsers, managerUsersService, state.users, activeTeamId, errorContext]);

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
        notifyManagerUsersError({
          operation: "updateUser",
          errorMessages: response.errorMessages,
          context: errorContext,
        });
        setState(prev => ({ ...prev, loading: false }));
      }
    } catch (error) {
      console.error("Erro ao atualizar usuário:", error);
      notifyManagerUsersError({
        operation: "updateUser",
        error,
        context: errorContext,
      });
      setState(prev => ({ ...prev, loading: false }));
    }
  }, [managerUsersService, loadUsers, errorContext]);

  // Deletar usuário
  const deleteUser = useCallback(async (userId: string) => {
    try {
      setState(prev => ({ ...prev, loading: true }));
      
      // Verificar se pode deletar
      const canDelete = await managerUsersService.canDeleteUser(userId);
      
      if (!canDelete) {
        notifyManagerUsersError({
          operation: "deleteUser",
          errorMessages: ["Não é possível deletar este usuário"],
          context: errorContext,
        });
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
        notifyManagerUsersError({
          operation: "deleteUser",
          errorMessages: response.errorMessages,
          context: errorContext,
        });
        setState(prev => ({ ...prev, loading: false }));
      }
    } catch (error) {
      console.error("Erro ao deletar usuário:", error);
      notifyManagerUsersError({
        operation: "deleteUser",
        error,
        context: errorContext,
      });
      setState(prev => ({ ...prev, loading: false }));
    }
  }, [supabaseId, loadUsers, errorContext]);

  // Preparar dados da tabela com permissões
  const resolvedProfileId = currentProfileId ?? supabaseId;
  const tableData: ManagerUserTableRow[] = state.users
    .filter(user => user.id !== resolvedProfileId)
    .map(user => {
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
        notifyManagerUsersError({
          operation: "resendInvite",
          errorMessages: result.errorMessages,
          context: errorContext,
        });
      }
    } catch (error) {
      toast.dismiss(toastId);
      console.error('Erro ao enviar email de reset:', error);
      notifyManagerUsersError({
        operation: "resendInvite",
        error,
        context: errorContext,
      });
    }
  }, [managerUsersService, errorContext]);

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
        notifyManagerUsersError({
          operation: "togglePermanentSubscription",
          errorMessages: result.errorMessages,
          context: errorContext,
        });
      }
    } catch (error) {
      console.error('Erro ao alternar assinatura permanente:', error);
      notifyManagerUsersError({
        operation: "togglePermanentSubscription",
        error,
        context: errorContext,
      });
    }
  }, [loadUsers, errorContext]);

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
