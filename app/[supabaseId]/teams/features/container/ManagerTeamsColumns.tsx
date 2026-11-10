"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { ArrowUpDown, CreditCard, ExternalLink, Loader2, XCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { formatIntimezone } from "@/lib/dates";
import type { ManagerTeamTableRow } from "../types";

/** Começa oculta (continua no filtro de data e em "Colunas"), para a tabela não rolar para o lado. */
export const MANAGER_TEAMS_HIDDEN_COLUMNS = ["createdAt"];

/** Ações curtas da linha, à vista. "Gerenciar" é o clique na linha. */
function TeamRowActions({
  team,
  isActive,
  isSwitching,
  isCanceling,
  canManageTeams,
  onSetActiveTeam,
  onViewPendingCheckout,
  onEditPendingPayment,
  onCancelPendingTeam,
}: {
  team: ManagerTeamTableRow
  isActive: boolean
  isSwitching: boolean
  isCanceling: boolean
  canManageTeams: boolean
  onSetActiveTeam: (teamId: string) => void
  onViewPendingCheckout: (team: ManagerTeamTableRow) => void
  onEditPendingPayment: (team: ManagerTeamTableRow) => void
  onCancelPendingTeam: (team: ManagerTeamTableRow) => void
}) {
  if (team.isPending) {
    return (
      <div className="flex flex-wrap justify-end gap-2">
        {canManageTeams && team.pendingPayment?.checkoutUrl ? (
          <Button size="sm" variant="outline" className="max-lg:min-h-11" onClick={() => onViewPendingCheckout(team)}>
            <ExternalLink data-icon="inline-start" aria-hidden />
            Ver pagamento
          </Button>
        ) : null}
        {canManageTeams && team.pendingPayment?.id ? (
          <Button size="sm" variant="outline" className="max-lg:min-h-11" onClick={() => onEditPendingPayment(team)}>
            <CreditCard data-icon="inline-start" aria-hidden />
            Trocar pagamento
          </Button>
        ) : null}
        <Button
          size="sm"
          variant="ghost"
          className="text-destructive hover:bg-destructive/10 hover:text-destructive max-lg:min-h-11"
          disabled={isCanceling}
          onClick={() => onCancelPendingTeam(team)}
        >
          {isCanceling ? <Loader2 className="animate-spin" data-icon="inline-start" /> : <XCircle data-icon="inline-start" aria-hidden />}
          {isCanceling ? "Cancelando..." : "Cancelar"}
        </Button>
      </div>
    );
  }
  if (isActive) return null;
  return (
    <div className="flex justify-end">
      <Button size="sm" variant="outline" className="max-lg:min-h-11" disabled={isSwitching} onClick={() => onSetActiveTeam(team.id)}>
        {isSwitching ? <Loader2 className="animate-spin" data-icon="inline-start" /> : null}
        {isSwitching ? "Trocando..." : "Usar este time"}
      </Button>
    </div>
  );
}

interface CreateColumnsProps {
  tz: string;
  activeTeamId: string | null;
  switchingTeamId: string | null;
  cancelingPendingTeamId: string | null;
  settingDefaultTeamId: string | null;
  ownAccountTeamCount: number;
  onSetActiveTeam: (teamId: string) => void;
  onSetDefaultTeam: (teamId: string) => void;
  onViewPendingCheckout: (team: ManagerTeamTableRow) => void;
  onEditPendingPayment: (team: ManagerTeamTableRow) => void;
  onCancelPendingTeam: (team: ManagerTeamTableRow) => void;
  canManageTeams: boolean;
}

export function createColumns({
  tz,
  activeTeamId,
  switchingTeamId,
  cancelingPendingTeamId,
  settingDefaultTeamId,
  ownAccountTeamCount,
  onSetActiveTeam,
  onSetDefaultTeam,
  onViewPendingCheckout,
  onEditPendingPayment,
  onCancelPendingTeam,
  canManageTeams,
}: CreateColumnsProps): ColumnDef<ManagerTeamTableRow>[] {
  const showDefaultTeamColumn = ownAccountTeamCount >= 2;

  const columns: ColumnDef<ManagerTeamTableRow>[] = [
    {
      accessorKey: "name",
      meta: { label: "Nome" },
      header: ({ column }) => (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          className="h-auto p-0 font-semibold max-lg:min-h-11"
        >
          Nome
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      ),
      cell: ({ row }) => (
        <div className="flex flex-col gap-1">
          <div className="font-medium">{row.getValue("name") || "—"}</div>
          <div className="flex flex-wrap gap-1">
            {row.original.isDefault ? (
              <Badge variant="secondary">Time padrão</Badge>
            ) : null}
            {row.original.isAssociateAccount ? (
              <Badge
                variant="outline"
                className="w-fit border-precision-border-soft bg-precision-indigo/10 text-precision-indigo"
              >
                Associado
              </Badge>
            ) : null}
          </div>
        </div>
      ),
    },
    {
      accessorKey: "role",
      meta: { label: "Nível de acesso", className: "hidden sm:table-cell" },
      header: ({ column }) => (
        <div className="flex justify-center">
          <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
            className="h-auto p-0 font-semibold max-lg:min-h-11"
          >
            Nível de acesso
            <ArrowUpDown className="ml-2 h-4 w-4" />
          </Button>
        </div>
      ),
      cell: ({ row }) => {
        const role = row.getValue("role") as string;
        const roleLabel =
          role === "manager" ? "MANAGER" : role === "backoffice" ? "BACKOFFICE" : "OPERATOR";
        const roleVariant = role === "operator" ? "secondary" : "default";
        return (
          <div className="flex justify-center">
            <Badge variant={roleVariant}>{roleLabel}</Badge>
          </div>
        );
      },
    },
    {
      accessorKey: "functions",
      meta: { label: "Funções", className: "hidden lg:table-cell" },
      header: ({ column }) => (
        <div className="flex justify-center">
          <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
            className="h-auto p-0 font-semibold max-lg:min-h-11"
          >
            Funções
            <ArrowUpDown className="ml-2 h-4 w-4" />
          </Button>
        </div>
      ),
      cell: ({ row }) => {
        const functions = row.original.functions || [];
        if (!functions.length) {
          return <div className="text-center text-muted-foreground">-</div>;
        }
        return (
          <div className="flex justify-center">
            <div className="flex flex-wrap justify-center gap-1">
              {functions.map((func) => (
                <Badge key={func} variant="secondary">
                  {func}
                </Badge>
              ))}
            </div>
          </div>
        );
      },
    },
    {
      id: "status",
      meta: { label: "Status" },
      header: ({ column }) => (
        <div className="flex justify-center">
          <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
            className="h-auto p-0 font-semibold max-lg:min-h-11"
          >
            Status
            <ArrowUpDown className="ml-2 h-4 w-4" />
          </Button>
        </div>
      ),
      cell: ({ row }) => {
        const isActive = row.original.id === activeTeamId;
        const pendingStatus = (row.original.pendingPayment?.paymentStatus ?? "").toUpperCase();
        const isPendingPayment = ["PENDING", "FAILED"].includes(pendingStatus);
        const label = isPendingPayment ? "Pagamento pendente" : isActive ? "Ativo" : "Inativo";
        const className = isPendingPayment
          ? "bg-yellow-100 text-yellow-800 border-yellow-200 dark:bg-yellow-900 dark:text-yellow-200"
          : isActive
            ? "bg-green-100 text-green-800 border-green-200 dark:bg-green-900 dark:text-green-200"
            : "bg-muted text-muted-foreground border-border";
        return (
          <div className="flex justify-center">
            <Badge variant="secondary" className={className}>
              {label}
            </Badge>
          </div>
        );
      },
      enableSorting: false,
    },
  ];

  if (showDefaultTeamColumn) {
    columns.splice(1, 0, {
      id: "isDefault",
      meta: { label: "Time padrão", className: "hidden md:table-cell" },
      header: () => <div className="flex justify-center font-semibold">Time padrão</div>,
      cell: ({ row }) => {
        const team = row.original;
        const isSettingDefault = settingDefaultTeamId === team.id;
        const toggleDisabled =
          !canManageTeams ||
          team.isAssociateAccount ||
          team.isPending ||
          team.isDefault ||
          isSettingDefault;

        return (
          <div className="flex justify-center">
            <Switch
              checked={team.isDefault}
              disabled={toggleDisabled}
              onCheckedChange={(checked) => {
                if (checked && !team.isDefault) {
                  onSetDefaultTeam(team.id);
                }
              }}
              aria-label={`Definir ${team.name} como time padrão`}
            />
          </div>
        );
      },
      enableSorting: false,
    });
  }

  columns.push(
    {
      accessorKey: "createdAt",
      meta: { label: "Criado em" },
      header: ({ column }) => (
        <div className="flex justify-center">
          <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
            className="h-auto p-0 font-semibold max-lg:min-h-11"
          >
            Criado em
            <ArrowUpDown className="ml-2 h-4 w-4" />
          </Button>
        </div>
      ),
      cell: ({ row }) => {
        const date = new Date(row.getValue("createdAt"));
        return (
          <div className="text-center text-muted-foreground">
            {formatIntimezone(date, "dd/MM/yyyy", tz)}
          </div>
        );
      },
      filterFn: (row, id, value) => {
        if (!Array.isArray(value)) return true;

        const [startDate, endDate] = value as [Date | undefined, Date | undefined];
        const rowDate = new Date(row.getValue(id) as string);

        if (Number.isNaN(rowDate.getTime())) return false;
        if (startDate && rowDate < startDate) return false;
        if (endDate && rowDate > endDate) return false;

        return true;
      },
    },
    {
      id: "actions",
      header: () => <span className="sr-only">Ações</span>,
      // Ações curtas à vista; "Gerenciar" é o clique na própria linha.
      cell: ({ row }) => (
        <TeamRowActions
          team={row.original}
          isActive={row.original.id === activeTeamId}
          isSwitching={switchingTeamId === row.original.id}
          isCanceling={cancelingPendingTeamId === row.original.id}
          canManageTeams={canManageTeams}
          onSetActiveTeam={onSetActiveTeam}
          onViewPendingCheckout={onViewPendingCheckout}
          onEditPendingPayment={onEditPendingPayment}
          onCancelPendingTeam={onCancelPendingTeam}
        />
      ),
      enableSorting: false,
      enableHiding: false,
    }
  );

  return columns;
}
