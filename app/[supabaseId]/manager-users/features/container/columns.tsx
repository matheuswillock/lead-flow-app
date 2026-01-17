"use client";

import { ColumnDef } from "@tanstack/react-table";
import { ArrowUpDown, MoreHorizontal, Pencil, Trash2, Mail, Crown } from "lucide-react";
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

interface CreateColumnsProps {
  onEdit: (user: ManagerUserTableRow) => void;
  onDelete: (user: ManagerUserTableRow) => void;
  onResendInvite: (email: string, userId?: string) => void;
  onDeletePendingOperator: (user: ManagerUserTableRow) => void;
  onTogglePermanentSubscription?: (userId: string, currentValue: boolean) => void;
  currentUserIsMaster?: boolean;
}

export function createColumns({ 
  onEdit, 
  onDelete, 
  onResendInvite,
  onDeletePendingOperator,
  onTogglePermanentSubscription,
  currentUserIsMaster = false
}: CreateColumnsProps): ColumnDef<ManagerUserTableRow>[] {
  return [
    {
      accessorKey: "profileIconUrl",
      header: "",
      cell: ({ row }) => {
        const user = row.original;
        const userName = user.name || "Usuário";
        const initials = userName
          .split(" ")
          .map(n => n[0])
          .join("")
          .toUpperCase()
          .slice(0, 2);

        return (
          <Avatar className="h-8 w-8">
            <AvatarImage src={user.profileIconUrl} alt={userName} />
            <AvatarFallback className="text-xs">{initials}</AvatarFallback>
          </Avatar>
        );
      },
      enableSorting: false,
      enableHiding: false,
    },
    {
      accessorKey: "name",
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
      header: ({ column }) => {
        return (
          <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
            className="h-auto p-0 font-semibold"
          >
            Papel
            <ArrowUpDown className="ml-2 h-4 w-4" />
          </Button>
        );
      },
      cell: ({ row }) => {
        const role = row.getValue("role") as string;
        return (
          <Badge variant={role === "manager" ? "default" : "secondary"}>
            {role === "manager" ? "MANAGER" : "OPERATOR"}
          </Badge>
        );
      },
    },
    {
      accessorKey: "status",
      header: ({ column }) => {
        return (
          <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
            className="h-auto p-0 font-semibold"
          >
            Status
            <ArrowUpDown className="ml-2 h-4 w-4" />
          </Button>
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
          }
        };

        const config = statusConfig[status] || statusConfig.active;

        return (
          <Badge variant={config.variant} className={config.className}>
            {config.label}
          </Badge>
        );
      },
    },
    {
      accessorKey: "leadsCount",
      header: ({ column }) => {
        return (
          <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
            className="h-auto p-0 font-semibold"
          >
            Leads
            <ArrowUpDown className="ml-2 h-4 w-4" />
          </Button>
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
      accessorKey: "createdAt",
      header: ({ column }) => {
        return (
          <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
            className="h-auto p-0 font-semibold"
          >
            Criado em
            <ArrowUpDown className="ml-2 h-4 w-4" />
          </Button>
        );
      },
      cell: ({ row }) => {
        const date = new Date(row.getValue("createdAt"));
        return (
          <div className="text-muted-foreground">
            {date.toLocaleDateString("pt-BR")}
          </div>
        );
      },
    },
    {
      id: "actions",
      header: "Ações",
      cell: ({ row }) => {
        const user = row.original;

        return (
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
                
                  <DropdownMenuItem
                    onClick={() => onDelete(user)}
                    className="flex items-center gap-2 text-destructive focus:text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                    Remover usuário
                  </DropdownMenuItem>
                </>
              ) : (
                <DropdownMenuItem
                  onClick={() => onDeletePendingOperator(user)}
                  className="flex items-center gap-2 text-destructive focus:text-destructive"
                >
                  <Trash2 className="h-4 w-4" />
                  Deletar operador pendente
                </DropdownMenuItem>
              )}
              
            </DropdownMenuContent>
          </DropdownMenu>
        );
      },
      enableSorting: false,
      enableHiding: false,
    },
  ];
}