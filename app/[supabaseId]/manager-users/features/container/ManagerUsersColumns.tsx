"use client";

import { ColumnDef } from "@tanstack/react-table";
import { ArrowUpDown, CircleCheck, CircleX, MoreHorizontal, Pencil, Trash2, Mail } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { CopyIcon } from "@/components/ui/copy";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ManagerUserTableRow } from "../types";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { formatIntimezone } from "@/lib/dates"

interface CreateColumnsProps {
  onEdit: (user: ManagerUserTableRow) => void;
  onDelete: (user: ManagerUserTableRow) => void;
  onResendInvite: (email: string, userId?: string) => void;
  onDeletePendingOperator: (user: ManagerUserTableRow) => void;
  onTogglePermanentSubscription?: (userId: string, currentValue: boolean) => void;
  currentUserIsMaster?: boolean;
  canDelete?: boolean;
  tz: string;
}

export function createColumns({ 
  onEdit, 
  onDelete, 
  onResendInvite,
  onDeletePendingOperator,
  onTogglePermanentSubscription: _onTogglePermanentSubscription,
  currentUserIsMaster: _currentUserIsMaster = false,
  canDelete = false,
  tz
}: CreateColumnsProps): ColumnDef<ManagerUserTableRow>[] {
  return [
    {
      accessorKey: "profileIconUrl",
      header: "",
      cell: ({ row }) => {
        const user = row.original;
        const userName = user.name || "Usuário";
        const avatarById =
          user.profileIconId && process.env.NEXT_PUBLIC_SUPABASE_URL
            ? `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/profile-icons/${user.profileIconId}`
            : undefined;
        const avatarSrc = user.profileIconUrl || avatarById;
        const initials = userName
          .split(" ")
          .map(n => n[0])
          .join("")
          .toUpperCase()
          .slice(0, 2);

        return (
          <div className="flex justify-center">
            <Avatar className="h-8 w-8">
              <AvatarImage src={avatarSrc || undefined} alt={userName} />
              <AvatarFallback className="text-xs">{initials}</AvatarFallback>
            </Avatar>
          </div>
        );
      },
      enableSorting: false,
      enableHiding: false,
    },
    {
      accessorKey: "name",
      meta: { label: "Nome" },
      header: ({ column }) => {
        return (
          <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
            className="h-auto p-0 font-semibold"
          >
            Nome Completo
            <ArrowUpDown className="ml-2 h-4 w-4" />
          </Button>
        );
      },
      cell: ({ row }) => (
        <div className="font-medium">{row.getValue("name") || "Nome não informado"}</div>
      ),
    },
    {
      accessorKey: "email",
      meta: { label: "Email" },
      header: ({ column }) => {
        return (
          <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
            className="h-auto p-0 font-semibold"
          >
            Email
            <ArrowUpDown className="ml-2 h-4 w-4" />
          </Button>
        );
      },
      cell: ({ row }) => {
        const email = row.getValue("email") as string || "Email não informado";
        
        return (
          <div className="flex items-center gap-2">
            <div className="text-muted-foreground">{email}</div>
            {email !== "Email não informado" && (                    
                <Tooltip>
                    <TooltipTrigger asChild>
                        <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 w-6 p-0 hover:bg-muted cursor-pointer"
                            onClick={() => navigator.clipboard.writeText(email)}
                        >
                            <CopyIcon size={14} className="text-muted-foreground hover:text-foreground" />
                        </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                        <p>Copiar e-mail</p>
                    </TooltipContent>
                </Tooltip>

            )}
          </div>
        );
      },
    },
    {
      accessorKey: "role",
      meta: { label: "Nível de acesso" },
      header: ({ column }) => {
        return (
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
        );
      },
      cell: ({ row }) => {
        const role = row.getValue("role") as string;
        const roleLabel = role === "manager"
          ? "MANAGER"
          : role === "backoffice"
          ? "BACKOFFICE"
          : "OPERATOR";

        const roleVariant = role === "operator" ? "secondary" : "default";
        return (
          <div className="flex justify-center">
            <Badge variant={roleVariant}>
              {roleLabel}
            </Badge>
          </div>
        );
      },
    },
    {
      id: "delegatedPermissions",
      meta: { label: "Delegações" },
      header: () => <div className="text-center font-semibold">Delegações</div>,
      cell: ({ row }) => {
        const user = row.original;
        const badges: string[] = [];

        if (user.role === "manager" && user.canCreateAccountUsers) {
          badges.push("Cadastrar usuários");
        }

        if (user.role === "manager" && user.canManageAccountTeams) {
          badges.push("Gerenciar times");
        }

        if (!badges.length) {
          return <div className="text-center text-muted-foreground">-</div>;
        }

        return (
          <div className="flex flex-wrap justify-center gap-1">
            {badges.map((badge) => (
              <Badge key={badge} variant="outline" className="text-[11px]">
                {badge}
              </Badge>
            ))}
          </div>
        );
      },
    },
    {
      accessorKey: "googleCalendarConnected",
      meta: { label: "Google conectado" },
      header: ({ column }) => {
        return (
          <div className="flex justify-center">
            <Button
              variant="ghost"
              onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
              className="h-auto p-0 font-semibold"
            >
              Google conectado
              <ArrowUpDown className="ml-2 h-4 w-4" />
            </Button>
          </div>
        );
      },
      cell: ({ row }) => {
        const isConnected = Boolean(row.getValue("googleCalendarConnected"));
        return (
          <div className="flex justify-center">
            {isConnected ? (
              <CircleCheck className="h-4 w-4 text-emerald-500" aria-hidden />
            ) : (
              <CircleX className="h-4 w-4 text-red-500" aria-hidden />
            )}
            <span className="sr-only">{isConnected ? "Sim" : "Não"}</span>
          </div>
        );
      },
    },
    {
      accessorKey: "functions",
      meta: { label: "Funções" },
      header: ({ column }) => {
        return (
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
        );
      },
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
      accessorKey: "status",
      meta: { label: "Status" },
      header: ({ column }) => {
        return (
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
        );
      },
      cell: ({ row }) => {
        const user = row.original;
        const status = user.status || "active";
        
        const statusConfig = {
          active: { 
            label: "Ativo", 
            variant: "default" as const,
            className: "bg-green-100 text-green-800 border-green-200 dark:bg-green-900 dark:text-green-200"
          },
          pending_payment: { 
            label: "Aguardando Pagamento", 
            variant: "secondary" as const,
            className: "bg-yellow-100 text-yellow-800 border-yellow-200 dark:bg-yellow-900 dark:text-yellow-200 animate-pulse"
          },
          payment_confirmed: { 
            label: "Pagamento Confirmado", 
            variant: "secondary" as const,
            className: "bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900 dark:text-blue-200"
          },
          pending_creation: { 
            label: "Criando Conta...", 
            variant: "secondary" as const,
            className: "bg-purple-100 text-purple-800 border-purple-200 dark:bg-purple-900 dark:text-purple-200 animate-pulse"
          },
          payment_failed: { 
            label: "Pagamento Falhou", 
            variant: "destructive" as const,
            className: "bg-red-100 text-red-800 border-red-200 dark:bg-red-900 dark:text-red-200"
          },
          subscription_updated: {
            label: "Assinatura Atualizada",
            variant: "secondary" as const,
            className: "bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-900 dark:text-emerald-200"
          }
        };

        const config = statusConfig[status] || statusConfig.active;

        return (
          <div className="flex justify-center">
            <Badge variant={config.variant} className={config.className}>
              {config.label}
            </Badge>
          </div>
        );
      },
    },
    {
      accessorKey: "leadsCount",
      meta: { label: "Leads" },
      header: ({ column }) => {
        return (
          <div className="flex justify-center">
            <Button
              variant="ghost"
              onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
              className="h-auto p-0 font-semibold"
            >
              Leads
              <ArrowUpDown className="ml-2 h-4 w-4" />
            </Button>
          </div>
        );
      },
      cell: ({ row }) => {
        const count = row.getValue("leadsCount") as number;
        return (
          <div className="text-center font-medium">
            {count || 0}
          </div>
        );
      },
    },
    {
      accessorKey: "meetingsCount",
      meta: { label: "Agendamentos" },
      header: ({ column }) => {
        return (
          <div className="flex justify-center">
            <Button
              variant="ghost"
              onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
              className="h-auto p-0 font-semibold"
            >
              Agendamentos
              <ArrowUpDown className="ml-2 h-4 w-4" />
            </Button>
          </div>
        );
      },
      cell: ({ row }) => {
        const user = row.original;
        const isCloser = user.functions?.includes("CLOSER");
        if (!isCloser) {
          return <div className="text-center text-muted-foreground">-</div>;
        }
        return (
          <div className="text-center font-medium">
            {user.meetingsCount || 0}
          </div>
        );
      },
    },
    {
      accessorKey: "createdAt",
      meta: { label: "Criado em" },
      header: ({ column }) => {
        return (
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
        );
      },
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
        const user = row.original;

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
                {user.status === 'active' ? (
                  <>
                    <DropdownMenuItem
                      onClick={() => onResendInvite(user.email, user.id)}
                      className="flex items-center gap-2"
                    >
                      <Mail className="h-4 w-4" />
                      Enviar reset de senha
                    </DropdownMenuItem>
                    
                    <DropdownMenuItem
                      onClick={() => onEdit(user)}
                      className="flex items-center gap-2"
                    >
                      <Pencil className="h-4 w-4" />
                      Editar usuário
                    </DropdownMenuItem>
                    {canDelete && (
                      <DropdownMenuItem
                        onClick={() => onDelete(user)}
                        className="flex items-center gap-2 text-destructive focus:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                        Remover usuário
                      </DropdownMenuItem>
                    )}
                  </>
                ) : (
                  canDelete ? (
                    <DropdownMenuItem
                      onClick={() => onDeletePendingOperator(user)}
                      className="flex items-center gap-2 text-destructive focus:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                      Deletar operador pendente
                    </DropdownMenuItem>
                  ) : null
                )}
                
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
