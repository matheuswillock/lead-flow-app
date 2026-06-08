"use client";

import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Clock, RefreshCw } from "lucide-react";
import { DataTable } from "@/app/[supabaseId]/components/data-table/DataTable";
import type { TeamSummary } from "@/app/context/TeamContext";
import { useTimezone } from "@/app/context/TimezoneContext";
import type { ManagerTeamTableRow } from "../types";
import { createColumns } from "./ManagerTeamsColumns";

interface ManagerTeamsContainerProps {
  teams: TeamSummary[];
  activeTeamId: string | null;
  switchingTeamId: string | null;
  onSetActiveTeam: (teamId: string) => void;
  onManageTeam: (teamId: string, teamName: string) => void;
  onViewPendingCheckout: (team: ManagerTeamTableRow) => void;
  onEditPendingPayment: (team: ManagerTeamTableRow) => void;
  onRefreshTeams: () => void;
  onOpenCreateTeam: () => void;
  canManageTeams: boolean;
  loading: boolean;
  error: string | null;
}

export function ManagerTeamsContainer({
  teams,
  activeTeamId,
  switchingTeamId,
  onSetActiveTeam,
  onManageTeam,
  onViewPendingCheckout,
  onEditPendingPayment,
  onRefreshTeams,
  onOpenCreateTeam,
  canManageTeams,
  loading,
  error,
}: ManagerTeamsContainerProps) {
  const { tz } = useTimezone();

  const tableData: ManagerTeamTableRow[] = teams.map((team) => ({
    id: team.id,
    name: team.name,
    masterId: team.masterId,
    isDefault: team.isDefault,
    role: team.role,
    functions: team.functions ?? [],
    createdAt: team.membershipCreatedAt,
    pendingPayment: team.pendingPayment ?? null,
  }));
  const pendingCount = tableData.filter((team) => {
    const status = (team.pendingPayment?.paymentStatus ?? "").toUpperCase();
    return status === "PENDING" || status === "FAILED";
  }).length;

  const columns = createColumns({
    tz,
    activeTeamId,
    switchingTeamId,
    onSetActiveTeam,
    onManageTeam,
    onViewPendingCheckout,
    onEditPendingPayment,
    canManageTeams,
  });

  return (
    <div className="container mx-auto py-6 px-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Gerenciar times</h1>
          <p className="text-muted-foreground">
            Gerencie os times aos quais você pertence e defina o time ativo.
            {pendingCount > 0 ? (
              <span className="inline-flex items-center gap-1 ml-2 text-yellow-600 dark:text-yellow-400">
                • {pendingCount} time{pendingCount > 1 ? "s" : ""} pendente{pendingCount > 1 ? "s" : ""}
              </span>
            ) : null}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={onRefreshTeams}
                disabled={loading}
                aria-label="Atualizar"
              >
                <RefreshCw className={loading ? "h-4 w-4 animate-spin" : "h-4 w-4"} />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Atualizar</TooltipContent>
          </Tooltip>
          <Button type="button" variant="outline" onClick={onOpenCreateTeam} disabled={!canManageTeams}>
            Criar time
          </Button>
        </div>
      </div>
      {pendingCount > 0 ? (
        <Alert className="border-yellow-200 bg-yellow-50 dark:bg-yellow-950 dark:border-yellow-800">
          <div className="flex items-center gap-3">
            <Clock className="h-5 w-5 text-yellow-600 dark:text-yellow-400" />
            <div className="flex-1">
              <AlertTitle className="text-yellow-800 dark:text-yellow-200 mb-1">
                {pendingCount} time{pendingCount > 1 ? "s" : ""} em processamento
              </AlertTitle>
              <AlertDescription className="text-yellow-700 dark:text-yellow-300 text-sm">
                {pendingCount > 1
                  ? "Os status dos times serão atualizados automaticamente após a confirmação dos pagamentos."
                  : "O status do time será atualizado automaticamente após a confirmação do pagamento."}
              </AlertDescription>
            </div>
            <RefreshCw className="h-4 w-4 text-yellow-600 dark:text-yellow-400 animate-spin" />
          </div>
        </Alert>
      ) : null}
      <div className="rounded-lg border border-border/60 bg-card p-6">
        {error ? (
          <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
            {error}
          </div>
        ) : (
          <DataTable
            columns={columns}
            data={tableData}
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
            loadingText="Carregando times..."
            emptyText="Nenhum time encontrado."
            countText={(count) => `${count} time(s) encontrado(s).`}
          />
        )}
      </div>
    </div>
  );
}
