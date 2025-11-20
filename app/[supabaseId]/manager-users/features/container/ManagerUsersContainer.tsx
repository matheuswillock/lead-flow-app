"use client";

import { Users,   } from "lucide-react";
import { UserRoundPlusIcon } from "@/components/ui/user-round-plus";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

import { useManagerUsers } from "../context/useManagerUsers";
import { DataTable } from "./DataTable";
import { createColumns } from "./columns";
import { UserFormDialog } from "./UserFormDialog";
import { DeleteUserDialog } from "./DeleteUserDialog";
import { PendingOperatorsAlert } from "./PendingOperatorsAlert";

interface ManagerUsersContainerProps {
  supabaseId: string;
  currentUserRole: string;
}

export function ManagerUsersContainer({
  supabaseId,
  currentUserRole,
}: ManagerUsersContainerProps) {
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
    
    // Controle de UI
    openCreateModal,
    closeCreateModal,
    openEditModal,
    closeEditModal,
    openDeleteDialog,
    closeDeleteDialog,
  } = useManagerUsers({ supabaseId, currentUserRole });

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

  const columns = createColumns({
    onEdit: openEditModal,
    onDelete: openDeleteDialog,
  });

  return (
    <div className="container mx-auto py-6 px-6 space-y-6">
      {/* Header */}
        <div className="flex items-center justify-between">
            <div>
            <h1 className="text-3xl font-bold tracking-tight">Gerenciar Operadores</h1>
            <p className="text-muted-foreground">
                Gerencie operadores do seu sistema
                {hasPendingOperators && (
                  <span className="inline-flex items-center gap-1 ml-2 text-yellow-600 dark:text-yellow-400">
                    • {pendingCount} operador{pendingCount > 1 ? 'es' : ''} pendente{pendingCount > 1 ? 's' : ''}
                  </span>
                )}
            </p>
            </div>

            <Button 
                onClick={openCreateModal} 
                className="gap-2 text-base cursor-pointer font-medium" 
                variant="outline"
            >
                <UserRoundPlusIcon />
                Adicionar Usuário
            </Button>
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
      <UserFormDialog
        open={isCreateModalOpen}
        onOpenChange={closeCreateModal}
        onSubmit={createUser}
        loading={loading}
        currentUserId={supabaseId}
      />

      <UserFormDialog
        open={isEditModalOpen}
        onOpenChange={closeEditModal}
        onSubmit={(data) => selectedUser ? updateUser(selectedUser.id, data) : Promise.resolve()}
        user={selectedUser}
        loading={loading}
        currentUserId={supabaseId}
      />

      <DeleteUserDialog
        open={isDeleteDialogOpen}
        onOpenChange={closeDeleteDialog}
        onConfirm={() => selectedUser ? deleteUser(selectedUser.id) : undefined}
        user={selectedUser}
        loading={loading}
      />
    </div>
  );
}