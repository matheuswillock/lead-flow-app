"use client";

import { useState } from "react";
import { Users,   } from "lucide-react";
import { UserRoundPlusIcon } from "@/components/ui/user-round-plus";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";

import { useManagerUsers } from "../context/useManagerUsers";
import { DataTable } from "./DataTable";
// import { createColumns } from "./columns";
import { UserFormDialog } from "./UserFormDialog";
import { DeleteUserDialog } from "./DeleteUserDialog";
import { DeletePendingOperatorDialog } from "./DeletePendingOperatorDialog";
import { PendingOperatorsAlert } from "./PendingOperatorsAlert";
import { OperatorCheckoutStep } from "../checkout/OperatorCheckoutStep";
import type { ManagerUserTableRow } from "../types";
import { createColumns } from "./ManagerUsersColumns";

interface ManagerUsersContainerProps {
  supabaseId: string;
  currentUserRole: string;
  currentUserIsMaster?: boolean;
  hasPermanentSubscription?: boolean;
}

export function ManagerUsersContainer({
  supabaseId,
  currentUserRole,
  currentUserIsMaster = false,
  hasPermanentSubscription = false,
}: ManagerUsersContainerProps) {
  const canCreateOrDelete = currentUserIsMaster;
  const [isDeletePendingDialogOpen, setIsDeletePendingDialogOpen] = useState(false);
  const [pendingOperatorToDelete, setPendingOperatorToDelete] = useState<ManagerUserTableRow | null>(null);

  const {
    // Estado
    tableData,
    loading,
    selectedUser,
    isCreateModalOpen,
    isEditModalOpen,
    isDeleteDialogOpen,
    stats,
    users,
    
    // Ações
    createUser,
    updateUser,
    deleteUser,
    resendInvite,
    togglePermanentSubscription,
    refreshData,
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
  } = useManagerUsers({ supabaseId, currentUserRole, hasPermanentSubscription });

  // Handler para abrir dialog de deletar operador pendente
  const handleDeletePendingOperator = (user: ManagerUserTableRow) => {
    setPendingOperatorToDelete(user);
    setIsDeletePendingDialogOpen(true);
  };

  // Handler para confirmar deleção de operador pendente
  const handleConfirmDeletePending = async () => {
    if (!pendingOperatorToDelete?.pendingPayment?.id) {
      toast.error('ID do operador pendente não encontrado');
      return;
    }

    const loadingToast = toast.loading('Deletando operador pendente...');

    try {
      const response = await fetch(`/api/v1/operators/pending/${pendingOperatorToDelete.pendingPayment.id}`, {
        method: 'DELETE',
      });

      const result = await response.json();

      if (!result.isValid) {
        throw new Error(result.errorMessages?.join(', ') || 'Erro ao deletar');
      }

      toast.success('Operador pendente deletado com sucesso!', { id: loadingToast });
      setIsDeletePendingDialogOpen(false);
      setPendingOperatorToDelete(null);
      
      // Atualizar dados
      await refreshData();

    } catch (error) {
      console.error('Erro ao deletar operador pendente:', error);
      toast.error('Erro ao deletar operador pendente', { id: loadingToast });
    }
  };

  // Verificar se há operadores pendentes
  const hasPendingOperators = users.some(user => user.isPending);
  const pendingCount = users.filter(user => user.isPending).length;

  // Verificar se é manager
  if (currentUserRole !== "manager") {
    return (
      <div className="container mx-auto py-8 px-6">
        <Card>
          <CardContent className="pt-6">
            <div className="text-center space-y-4">
              <Users className="mx-auto h-12 w-12 text-muted-foreground" />
              <div>
                <h3 className="text-lg font-semibold">Acesso Restrito</h3>
                <p className="text-muted-foreground">
                  Apenas usuários com papel de Manager podem acessar esta página.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }


  if (operatorCheckout.isOpen && operatorCheckout.operatorData) {
    return (
      <OperatorCheckoutStep
        managerId={supabaseId}
        operatorData={operatorCheckout.operatorData}
        onCancel={closeOperatorCheckout}
        onComplete={completeOperatorCheckout}
      />
    );
  }

  const columns = createColumns({
    onEdit: openEditModal,
    onDelete: openDeleteDialog,
    onDeletePendingOperator: handleDeletePendingOperator,
    onResendInvite: resendInvite,
    onTogglePermanentSubscription: togglePermanentSubscription,
    currentUserIsMaster,
    canDelete: canCreateOrDelete,
  });

  return (
    <div className="container mx-auto py-6 px-6 space-y-6">
      {/* Header */}
        <div className="flex items-center justify-between">
            <div>
            <h1 className="text-3xl font-bold tracking-tight">Gerenciar Usuários</h1>
            <p className="text-muted-foreground">
                Gerencie os usuários do seu studio.
                {hasPendingOperators && (
                  <span className="inline-flex items-center gap-1 ml-2 text-yellow-600 dark:text-yellow-400">
                    • {pendingCount} usuário{pendingCount > 1 ? 's' : ''} pendente{pendingCount > 1 ? 's' : ''}
                  </span>
                )}
            </p>
            </div>

            {canCreateOrDelete && (
              <Button 
                  onClick={openCreateModal} 
                  className="gap-2 text-base cursor-pointer font-medium" 
                  variant="outline"
              >
                  <UserRoundPlusIcon />
                  Adicionar Usuário
              </Button>
            )}
        </div>

      {/* Alerta de operadores pendentes */}
      <PendingOperatorsAlert count={pendingCount} />

      {/* Cards de Estatísticas */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total de Usuários</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <div className="text-2xl font-bold">{stats?.totalUsers ?? 0}</div>
            )}
            <p className="text-xs text-muted-foreground">
              Managers e Operators
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Managers</CardTitle>
            <Badge variant="default" className="text-xs">MGR</Badge>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <div className="text-2xl font-bold">{stats?.totalManagers ?? 0}</div>
            )}
            <p className="text-xs text-muted-foreground">
              Incluindo você
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Operators</CardTitle>
            <Badge variant="secondary" className="text-xs">OPR</Badge>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <div className="text-2xl font-bold">{stats?.totalOperators ?? 0}</div>
            )}
            <p className="text-xs text-muted-foreground">
              Usuários gerenciados
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Tabela */}
      <Card>
        <CardContent className="p-6">
          <DataTable
            columns={columns}
            data={tableData}
            loading={loading}
          />
        </CardContent>
      </Card>

      {/* Modais */}
      {canCreateOrDelete && (
        <UserFormDialog
          open={isCreateModalOpen}
          onOpenChange={closeCreateModal}
          onSubmit={createUser}
          loading={loading}
          currentUserId={supabaseId}
        />
      )}

      <UserFormDialog
        open={isEditModalOpen}
        onOpenChange={closeEditModal}
        onSubmit={(data) => selectedUser ? updateUser(selectedUser.id, data) : Promise.resolve()}
        user={selectedUser}
        loading={loading}
        currentUserId={supabaseId}
      />

      {canCreateOrDelete && (
        <>
          <DeleteUserDialog
            open={isDeleteDialogOpen}
            onOpenChange={closeDeleteDialog}
            onConfirm={() => selectedUser ? deleteUser(selectedUser.id) : undefined}
            user={selectedUser}
            loading={loading}
          />

          <DeletePendingOperatorDialog
            open={isDeletePendingDialogOpen}
            onOpenChange={setIsDeletePendingDialogOpen}
            operatorName={pendingOperatorToDelete?.name || ''}
            operatorEmail={pendingOperatorToDelete?.email || ''}
            onConfirm={handleConfirmDeletePending}
          />
        </>
      )}
    </div>
  );
}
