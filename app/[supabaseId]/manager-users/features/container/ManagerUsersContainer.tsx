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
import { DataTable } from "@/app/[supabaseId]/components/data-table/DataTable";
// import { createColumns } from "./columns";
import { UserFormDialog } from "./UserFormDialog";
import { DeleteUserDialog } from "./DeleteUserDialog";
import { DeletePendingOperatorDialog } from "./DeletePendingOperatorDialog";
import { PendingOperatorsAlert } from "./PendingOperatorsAlert";
import { PendingPaymentEditDialog } from "./PendingPaymentEditDialog";
import type { ManagerUserTableRow } from "../types";
import { createColumns } from "./ManagerUsersColumns";
import { useTeamContext } from "@/app/context/TeamContext";
import { useUserContext } from "@/app/context/UserContext";
import { notifyManagerUsersError } from "../utils/managerUsersErrors";
import { isManagerLikeRole } from "@/lib/roles";
import { useTimezone } from "@/app/context/TimezoneContext";
import { useBillingSlots } from "@/app/hooks/useBillingSlots";

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
  const { user } = useUserContext();
  const { tz } = useTimezone();
  const { activeRole, isTeamMaster, activeTeamId } = useTeamContext();
  const resolvedRole = activeRole ?? currentUserRole;
  const resolvedIsMaster = isTeamMaster ?? currentUserIsMaster;
  const canCreateUser = resolvedIsMaster || (resolvedRole === "manager" && user?.canCreateAccountUsers === true);
  const canDeleteUser = resolvedIsMaster;
  const canManagePendingPayments = resolvedIsMaster || (resolvedRole === "manager" && user?.canCreateAccountUsers === true);
  const { hasAvailableUserSlot } = useBillingSlots(supabaseId, resolvedIsMaster);
  const [isDeletePendingDialogOpen, setIsDeletePendingDialogOpen] = useState(false);
  const [pendingOperatorToDelete, setPendingOperatorToDelete] = useState<ManagerUserTableRow | null>(null);
  const [isEditPendingPaymentOpen, setIsEditPendingPaymentOpen] = useState(false);
  const [pendingPaymentTarget, setPendingPaymentTarget] = useState<ManagerUserTableRow | null>(null);
  const [pendingPaymentBillingType, setPendingPaymentBillingType] = useState<"PIX" | "CREDIT_CARD">("PIX");
  const [pendingPaymentLoading, setPendingPaymentLoading] = useState(false);
  const [pendingPaymentSubmitting, setPendingPaymentSubmitting] = useState(false);
  const [pendingPaymentSummary, setPendingPaymentSummary] = useState({
    addonLabel: "",
    addonDetail: "",
    totalCharge: 0,
    remainingMonths: 1,
  });
  const errorContext = {
    supabaseId,
    teamId: activeTeamId ?? undefined,
    userId: user?.id,
  };

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
    
    // Controle de UI
    openCreateModal,
    closeCreateModal,
    openEditModal,
    closeEditModal,
    openDeleteDialog,
    closeDeleteDialog,
  } = useManagerUsers({
    supabaseId,
    currentUserRole,
    currentProfileId: user?.id,
    currentUserIsMaster: resolvedIsMaster,
    currentUserCanCreateUsers: user?.canCreateAccountUsers === true,
    hasPermanentSubscription,
  });

  // Handler para abrir dialog de deletar operador pendente
  const handleDeletePendingOperator = (user: ManagerUserTableRow) => {
    setPendingOperatorToDelete(user);
    setIsDeletePendingDialogOpen(true);
  };

  const handleViewPendingCheckout = (user: ManagerUserTableRow) => {
    const checkoutUrl = user.pendingPayment?.checkoutUrl;
    if (!checkoutUrl) {
      toast.error("Checkout indisponível para este pagamento.");
      return;
    }
    window.open(checkoutUrl, "_blank", "noopener,noreferrer");
  };

  const handleOpenEditPendingPayment = async (user: ManagerUserTableRow) => {
    const pendingActionId = user.pendingPayment?.pendingActionId;
    if (!pendingActionId) {
      toast.error("Não foi possível localizar o pagamento pendente.");
      return;
    }

    setPendingPaymentTarget(user);
    setIsEditPendingPaymentOpen(true);
    setPendingPaymentLoading(true);

    try {
      const response = await fetch(`/api/v1/addon-checkout/${pendingActionId}`);
      const result = await response.json();
      if (!response.ok || !result?.isValid || !result?.result) {
        throw new Error(result?.errorMessages?.[0] || "Falha ao carregar dados do pagamento");
      }

      const details = result.result as any;
      setPendingPaymentBillingType(details.presetBillingType === "CREDIT_CARD" ? "CREDIT_CARD" : "PIX");
      setPendingPaymentSummary({
        addonLabel: details.addonLabel ?? "Pagamento pendente",
        addonDetail: details.addonDetail ?? user.name,
        totalCharge: Number(details.pricing?.totalCharge ?? 0),
        remainingMonths: Number(details.pricing?.remainingMonths ?? 1),
      });
    } catch (error: any) {
      toast.error(error?.message || "Erro ao carregar pagamento pendente.");
      setIsEditPendingPaymentOpen(false);
      setPendingPaymentTarget(null);
    } finally {
      setPendingPaymentLoading(false);
    }
  };

  const handleSubmitEditPendingPayment = async () => {
    const pendingActionId = pendingPaymentTarget?.pendingPayment?.pendingActionId;
    if (!pendingActionId) return;

    setPendingPaymentSubmitting(true);
    try {
      const response = await fetch(`/api/v1/addon-checkout/${pendingActionId}/billing-type`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ billingType: pendingPaymentBillingType }),
      });
      const result = await response.json();
      if (!response.ok || !result?.isValid) {
        throw new Error(result?.errorMessages?.[0] || "Erro ao atualizar forma de pagamento");
      }

      toast.success("Forma de pagamento atualizada.");
      setIsEditPendingPaymentOpen(false);
      setPendingPaymentTarget(null);
      await refreshData();
    } catch (error: any) {
      toast.error(error?.message || "Erro ao atualizar forma de pagamento.");
    } finally {
      setPendingPaymentSubmitting(false);
    }
  };

  // Handler para confirmar deleção de operador pendente
  const handleConfirmDeletePending = async () => {
    if (!pendingOperatorToDelete?.pendingPayment?.id) {
      notifyManagerUsersError({
        operation: "deletePendingOperator",
        errorMessages: ["ID do operador pendente não encontrado"],
        context: errorContext,
      });
      return;
    }

    const loadingToast = toast.loading('Deletando operador pendente...');

    try {
      const response = await fetch(`/api/v1/operators/pending/${pendingOperatorToDelete.pendingPayment.id}`, {
        method: 'DELETE',
      });

      const result = await response.json();

      if (!result.isValid) {
        console.error('[handleConfirmDeletePending]', result.errorMessages);
        toast.dismiss(loadingToast);
        notifyManagerUsersError({
          operation: "deletePendingOperator",
          errorMessages: result.errorMessages,
          context: errorContext,
        });
        return;
      }

      toast.success('Operador pendente deletado com sucesso!', { id: loadingToast });
      setIsDeletePendingDialogOpen(false);
      setPendingOperatorToDelete(null);

      // Atualizar dados
      await refreshData();

    } catch (error) {
      console.error('Erro ao deletar operador pendente:', error);
      notifyManagerUsersError({
        operation: "deletePendingOperator",
        error,
        toastId: loadingToast,
        context: errorContext,
      });
    }
  };

  // Verificar se há operadores pendentes
  const hasPendingOperators = users.some(user => user.isPending);
  const pendingCount = users.filter(user => user.isPending).length;

  // Verificar se é manager
  if (!isManagerLikeRole(resolvedRole)) {
    return (
      <div className="container mx-auto py-8 px-6">
        <Card>
          <CardContent className="pt-6">
            <div className="text-center space-y-4">
              <Users className="mx-auto h-12 w-12 text-muted-foreground" />
              <div>
                <h3 className="text-lg font-semibold">Acesso Restrito</h3>
                <p className="text-muted-foreground">
                  Apenas usuários com nível de gestão (Manager ou Backoffice) podem acessar esta página.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const columns = createColumns({
    onEdit: openEditModal,
    onDelete: openDeleteDialog,
    onDeletePendingOperator: handleDeletePendingOperator,
    onViewPendingCheckout: handleViewPendingCheckout,
    onEditPendingPayment: handleOpenEditPendingPayment,
    onResendInvite: resendInvite,
    onTogglePermanentSubscription: togglePermanentSubscription,
    currentUserIsMaster: resolvedIsMaster,
    canDelete: canDeleteUser,
    canManagePendingPayments,
    tz,
  });

  // O usuário logado não deve se ver na tabela de gerenciamento.
  const visibleTableData = user?.id ? tableData.filter((row) => row.id !== user.id) : tableData;

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

            {canCreateUser && (
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
              Gestores e Operators
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
            data={visibleTableData}
            loading={loading}
            toolbar={{
              search: { columnId: "name", placeholder: "Buscar por nome ou e-mail..." },
              selectFilters: [
                {
                  columnId: "role",
                  placeholder: "Filtrar por nível",
                  options: [
                    { value: "all", label: "Todos os níveis" },
                    { value: "manager", label: "Manager" },
                    { value: "backoffice", label: "Backoffice" },
                    { value: "operator", label: "Operator" },
                  ],
                },
              ],
              dateRangeFilter: { columnId: "createdAt", title: "Data de Criação" },
              columnsToggle: { label: "Colunas" },
            }}
            loadingText="Carregando usuários..."
            emptyText="Nenhum usuário encontrado."
            countText={(count) => `${count} usuário(s) encontrado(s).`}
          />
        </CardContent>
      </Card>

      {/* Modais */}
      {canCreateUser && (
        <UserFormDialog
          open={isCreateModalOpen}
          onOpenChange={closeCreateModal}
          onSubmit={createUser}
          loading={loading}
          supabaseId={supabaseId}
          currentProfileId={user?.id}
          hasAvailableUserSlot={hasAvailableUserSlot}
        />
      )}

      <UserFormDialog
        open={isEditModalOpen}
        onOpenChange={closeEditModal}
        onSubmit={(data) => selectedUser ? updateUser(selectedUser.id, data) : Promise.resolve()}
        user={selectedUser}
        loading={loading}
        supabaseId={supabaseId}
        currentProfileId={user?.id}
      />

      {canDeleteUser && (
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

      <PendingPaymentEditDialog
        open={isEditPendingPaymentOpen}
        loading={pendingPaymentLoading}
        submitting={pendingPaymentSubmitting}
        billingType={pendingPaymentBillingType}
        addonLabel={pendingPaymentSummary.addonLabel}
        addonDetail={pendingPaymentSummary.addonDetail}
        totalCharge={pendingPaymentSummary.totalCharge}
        remainingMonths={pendingPaymentSummary.remainingMonths}
        onBillingTypeChange={setPendingPaymentBillingType}
        onSubmit={handleSubmitEditPendingPayment}
        onOpenChange={(open) => {
          setIsEditPendingPaymentOpen(open);
          if (!open) {
            setPendingPaymentTarget(null);
          }
        }}
      />
    </div>
  );
}
