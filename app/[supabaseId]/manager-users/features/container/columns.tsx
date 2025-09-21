"use client";

import { ColumnDef } from "@tanstack/react-table";
import { ArrowUpDown, MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ManagerUserTableRow } from "../types";

interface CreateColumnsProps {
  onEdit: (user: ManagerUserTableRow) => void;
  onDelete: (user: ManagerUserTableRow) => void;
}

export function createColumns({ onEdit, onDelete }: CreateColumnsProps): ColumnDef<ManagerUserTableRow>[] {
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
      cell: ({ row }) => (
        <div className="text-muted-foreground">{row.getValue("email") || "Email não informado"}</div>
      ),
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
              <DropdownMenuLabel >Ações</DropdownMenuLabel>
              <DropdownMenuItem
                onClick={() => navigator.clipboard.writeText(user.email)}
              >
                Copiar email
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              {user.canEdit && (
                <DropdownMenuItem
                  onClick={() => onEdit(user)}
                  className="flex items-center gap-2"
                >
                  <Pencil className="h-4 w-4" />
                  Editar usuário
                </DropdownMenuItem>
              )}
              {user.canDelete && (
                <DropdownMenuItem
                  onClick={() => onDelete(user)}
                  className="flex items-center gap-2 text-destructive focus:text-destructive"
                >
                  <Trash2 className="h-4 w-4" />
                  Remover usuário
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