"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { RefreshCw } from "lucide-react";
import { DataTable } from "@/app/[supabaseId]/components/data-table/DataTable";
import type { TeamSummary } from "@/app/context/TeamContext";
import { useTimezone } from "@/app/context/TimezoneContext";
import type { ManagerTeamTableRow } from "../types";
import { createColumns } from "./ManagerTeamsColumns";

interface ManagerTeamsContainerProps {
  teams: TeamSummary[];
  activeTeamId: string | null;
  switchingTeamId: string | null;
  currentUserId: string | null;
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
  currentUserId,
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

  const columns = createColumns({
    tz,
    activeTeamId,
    switchingTeamId,
    currentUserId,
    onSetActiveTeam,
    onManageTeam,
    onViewPendingCheckout,
    onEditPendingPayment,
    canManageTeams,
  });

  return (
    <div className="container mx-auto py-6 px-6 space-y-6">
      <Card className="border-border/60 shadow-sm">
        <CardHeader className="space-y-2">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="space-y-2">
              <CardTitle className="text-2xl">Gerenciar times</CardTitle>
              <p className="text-sm text-muted-foreground">
                Gerencie os times aos quais voce pertence e defina o time ativo.
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
              <Button type="button" variant="secondary" onClick={onOpenCreateTeam} disabled={!canManageTeams}>
                Criar time
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
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
                search: { columnId: "name", placeholder: "Buscar por nome ou email..." },
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
        </CardContent>
      </Card>
    </div>
  );
}
