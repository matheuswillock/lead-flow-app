"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { ArrowUpDown, MoreHorizontal, Settings } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { formatIntimezone } from "@/lib/dates";
import type { ManagerTeamTableRow } from "../types";

interface CreateColumnsProps {
  tz: string;
  activeTeamId: string | null;
  switchingTeamId: string | null;
  currentUserId: string | null;
  onSetActiveTeam: (teamId: string) => void;
  onManageTeam: (teamId: string, teamName: string) => void;
}

export function createColumns({
  tz,
  activeTeamId,
  switchingTeamId,
  currentUserId,
  onSetActiveTeam,
  onManageTeam,
}: CreateColumnsProps): ColumnDef<ManagerTeamTableRow>[] {
  return [
    {
      accessorKey: "name",
      meta: { label: "Nome" },
      header: ({ column }) => (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          className="h-auto p-0 font-semibold"
        >
          Nome
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      ),
      cell: ({ row }) => <div className="font-medium">{row.getValue("name") || "—"}</div>,
    },
    {
      accessorKey: "role",
      meta: { label: "Nível de acesso" },
      header: ({ column }) => (
        <div className="flex justify-center">
          <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
            className="h-auto p-0 font-semibold"
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
      meta: { label: "Funções" },
      header: ({ column }) => (
        <div className="flex justify-center">
          <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
            className="h-auto p-0 font-semibold"
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
            className="h-auto p-0 font-semibold"
          >
            Status
            <ArrowUpDown className="ml-2 h-4 w-4" />
          </Button>
        </div>
      ),
      cell: ({ row }) => {
        const isActive = row.original.id === activeTeamId;
        const label = isActive ? "Ativo" : "Inativo";
        const className = isActive
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
    {
      accessorKey: "createdAt",
      meta: { label: "Criado em" },
      header: ({ column }) => (
        <div className="flex justify-center">
          <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
            className="h-auto p-0 font-semibold"
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
      header: "Ações",
      cell: ({ row }) => {
        const team = row.original;
        const isActive = team.id === activeTeamId;
        const isMaster = !!(currentUserId && team.masterId === currentUserId);

        return (
          <div className="flex justify-center">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="h-8 w-8 p-0 cursor-pointer">
                  <span className="sr-only">Abrir menu</span>
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel>Ações</DropdownMenuLabel>
                <DropdownMenuItem
                  onClick={() => onSetActiveTeam(team.id)}
                  disabled={isActive || switchingTeamId === team.id}
                  className="flex items-center gap-2"
                >
                  {isActive ? "Time ativo" : switchingTeamId === team.id ? "Alterando..." : "Definir ativo"}
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => onManageTeam(team.id, team.name)}
                  disabled={!isMaster}
                  className="flex items-center gap-2"
                >
                  <Settings className="h-4 w-4" />
                  Gerenciar
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        );
      },
      enableSorting: false,
      enableHiding: false,
    },
  ];
}

