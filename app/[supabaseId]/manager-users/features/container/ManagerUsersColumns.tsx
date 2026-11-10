"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { ArrowUpDown, CircleCheck, CircleX } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { formatIntimezone } from "@/lib/dates";
import { describeAccessSummary, type TeamMemberAccessSummary } from "@/lib/team-member-access/access-history";
import type { ManagerUserTableRow } from "../types";
import { ACCESS_TONE_CLASS, ROLE_LABEL, delegationLabelsOf } from "../utils/managerUserDisplay";

/**
 * Colunas que começam ocultas: o detalhe delas está no painel aberto pela linha. Continuam
 * disponíveis em "Colunas" e para os filtros (a data de criação, por exemplo).
 */
export const MANAGER_USERS_HIDDEN_COLUMNS = [
  "delegatedPermissions",
  "googleCalendarConnected",
  "leadsCount",
  "meetingsCount",
  "createdAt",
];

const STATUS_CONFIG: Record<ManagerUserTableRow["status"], { label: string; className: string }> = {
  active: { label: "Ativo", className: "border-semantic-success-border bg-semantic-success-surface text-semantic-success" },
  pending_payment: { label: "Aguardando pagamento", className: "border-semantic-warning-border bg-semantic-warning-surface text-semantic-warning" },
  payment_confirmed: { label: "Pagamento confirmado", className: "border-border bg-muted text-foreground" },
  pending_creation: { label: "Criando conta", className: "border-border bg-muted text-foreground" },
  payment_failed: { label: "Pagamento falhou", className: "border-destructive/30 bg-destructive/10 text-destructive" },
  subscription_updated: { label: "Assinatura atualizada", className: "border-border bg-muted text-foreground" },
};

function SortableHeader({ label, onToggle, align = "start" }: { label: string; onToggle: () => void; align?: "start" | "center" }) {
  return (
    <div className={cn("flex", align === "center" && "justify-center")}>
      <Button variant="ghost" onClick={onToggle} className="h-auto p-0 font-semibold">
        {label}
        <ArrowUpDown className="ml-2 h-4 w-4" />
      </Button>
    </div>
  );
}

function avatarSrcOf(user: ManagerUserTableRow): string | undefined {
  const byId =
    user.profileIconId && process.env.NEXT_PUBLIC_SUPABASE_URL
      ? `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/profile-icons/${user.profileIconId}`
      : undefined;
  return user.profileIconUrl || byId;
}

/** Foto, nome e e-mail numa célula só: é o que identifica a pessoa sem gastar largura. */
function UserCell({ user }: { user: ManagerUserTableRow }) {
  const name = user.name || "Usuário";
  const initials = name.split(" ").map((part) => part[0]).join("").toUpperCase().slice(0, 2);
  return (
    <div className="flex min-w-0 items-center gap-3">
      <Avatar className="size-8 shrink-0">
        <AvatarImage src={avatarSrcOf(user)} alt="" />
        <AvatarFallback className="text-xs">{initials}</AvatarFallback>
      </Avatar>
      <div className="flex min-w-0 flex-col">
        <span className="font-medium text-foreground [overflow-wrap:anywhere]">{user.name || "Nome não informado"}</span>
        <span className="text-xs text-muted-foreground [overflow-wrap:anywhere]">{user.email}</span>
      </div>
    </div>
  );
}

// No celular o selo quebra em duas linhas em vez de empurrar a tabela para o lado.
const BADGE_CLASS = "inline-block rounded-2xl border px-2 py-0.5 text-xs font-semibold sm:whitespace-nowrap sm:rounded-full";

/** Selo da situação de acesso: o que pede ação (e-mail não entregue) aparece em vermelho. */
function AccessCell({ user, summary, isLoading }: {
  user: ManagerUserTableRow
  summary: TeamMemberAccessSummary | undefined
  isLoading: boolean
}) {
  if (user.status !== "active") {
    const status = STATUS_CONFIG[user.status] ?? STATUS_CONFIG.active;
    return <span className={cn(BADGE_CLASS, status.className)}>{status.label}</span>;
  }
  if (!summary) {
    return isLoading ? <Skeleton className="h-5 w-28 rounded-full" /> : <span className="text-xs text-muted-foreground">—</span>;
  }
  const access = describeAccessSummary(summary);
  return (
    <span className={cn(BADGE_CLASS, ACCESS_TONE_CLASS[access.tone])}>
      {access.label}
    </span>
  );
}

interface CreateColumnsProps {
  /** Situação de acesso por usuário (coluna "Acesso"). As ações ficam no painel aberto pela linha. */
  accessSummaryById: ReadonlyMap<string, TeamMemberAccessSummary>;
  isAccessSummaryLoading: boolean;
  tz: string;
}

export function createColumns({ accessSummaryById, isAccessSummaryLoading, tz }: CreateColumnsProps): ColumnDef<ManagerUserTableRow>[] {
  return [
    {
      accessorKey: "name",
      meta: { label: "Usuário" },
      header: ({ column }) => <SortableHeader label="Usuário" onToggle={() => column.toggleSorting(column.getIsSorted() === "asc")} />,
      cell: ({ row }) => <UserCell user={row.original} />,
      // A busca acha por nome ou e-mail.
      filterFn: (row, _id, value) => {
        const term = String(value ?? "").trim().toLowerCase();
        if (!term) return true;
        return `${row.original.name} ${row.original.email}`.toLowerCase().includes(term);
      },
      enableHiding: false,
    },
    {
      id: "access",
      meta: { label: "Acesso" },
      header: () => <span className="font-semibold">Acesso</span>,
      cell: ({ row }) => (
        <AccessCell user={row.original} summary={accessSummaryById.get(row.original.id)} isLoading={isAccessSummaryLoading} />
      ),
      enableSorting: false,
      enableHiding: false,
    },
    {
      accessorKey: "role",
      // No celular o nível fica no painel: a tabela mostra só pessoa e acesso.
      meta: { label: "Nível", className: "hidden md:table-cell" },
      header: ({ column }) => <SortableHeader label="Nível" onToggle={() => column.toggleSorting(column.getIsSorted() === "asc")} />,
      cell: ({ row }) => {
        const user = row.original;
        const functions = user.functions ?? [];
        return (
          <div className="flex flex-wrap items-center gap-1">
            <Badge variant={user.role === "operator" ? "secondary" : "default"}>{ROLE_LABEL[user.role]}</Badge>
            {functions.map((fn) => (
              <Badge key={fn} variant="outline" className="text-[11px]">{fn}</Badge>
            ))}
          </div>
        );
      },
    },
    {
      id: "delegatedPermissions",
      meta: { label: "Delegações" },
      header: () => <span className="font-semibold">Delegações</span>,
      cell: ({ row }) => {
        const labels = delegationLabelsOf(row.original);
        return labels.length ? labels.join(", ") : <span className="text-muted-foreground">—</span>;
      },
    },
    {
      accessorKey: "googleCalendarConnected",
      meta: { label: "Google conectado" },
      header: () => <span className="font-semibold">Google</span>,
      cell: ({ row }) =>
        row.original.googleCalendarConnected ? (
          <CircleCheck className="size-4 text-semantic-success" aria-label="Conectado" />
        ) : (
          <CircleX className="size-4 text-muted-foreground" aria-label="Não conectado" />
        ),
    },
    {
      accessorKey: "leadsCount",
      meta: { label: "Leads" },
      header: ({ column }) => <SortableHeader label="Leads" onToggle={() => column.toggleSorting(column.getIsSorted() === "asc")} />,
      cell: ({ row }) => <span className="tabular-nums">{row.original.leadsCount ?? 0}</span>,
    },
    {
      accessorKey: "meetingsCount",
      meta: { label: "Agendamentos" },
      header: ({ column }) => <SortableHeader label="Agendamentos" onToggle={() => column.toggleSorting(column.getIsSorted() === "asc")} />,
      cell: ({ row }) => <span className="tabular-nums">{row.original.meetingsCount ?? 0}</span>,
    },
    {
      accessorKey: "createdAt",
      meta: { label: "Criado em" },
      header: ({ column }) => <SortableHeader label="Criado em" onToggle={() => column.toggleSorting(column.getIsSorted() === "asc")} />,
      cell: ({ row }) => (
        <span className="text-muted-foreground">{formatIntimezone(new Date(row.getValue("createdAt")), "dd/MM/yyyy", tz)}</span>
      ),
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
  ];
}
