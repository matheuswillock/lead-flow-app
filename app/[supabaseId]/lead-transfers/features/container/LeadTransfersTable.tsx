"use client";

import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
} from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { getLeadStatusBadgeClass, getLeadStatusLabel } from "@/lib/lead-status";
import { useLeadTransfersContext } from "../context/LeadTransfersContext";
import type { LeadTransferMemberRef, LeadTransferRow } from "../context/LeadTransfersTypes";

function getInitials(name: string | null | undefined, email: string): string {
  const source = (name ?? email).trim();
  if (!source) return "?";
  const parts = source.split(/\s+/).filter(Boolean);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] ?? ""}${parts[parts.length - 1][0] ?? ""}`.toUpperCase();
}

function MemberCell({ member }: { member: LeadTransferMemberRef | null }) {
  if (!member) {
    return <span className="text-muted-foreground">—</span>;
  }

  const displayName = member.fullName ?? member.email;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div className="inline-flex justify-center">
          <Avatar className="size-7">
            <AvatarFallback className="text-xs">
              {getInitials(member.fullName, member.email)}
            </AvatarFallback>
          </Avatar>
        </div>
      </TooltipTrigger>
      <TooltipContent>{displayName}</TooltipContent>
    </Tooltip>
  );
}

function formatDateTime(value: string | null) {
  if (!value) return "—";
  return format(new Date(value), "dd/MM/yyyy HH:mm", { locale: ptBR });
}

function TransferStateBadge({ state }: { state: LeadTransferRow["transferState"] }) {
  if (state === "pending") {
    return (
      <Badge variant="outline" className="border-semantic-warning-border bg-semantic-warning-surface text-semantic-warning">
        Pendente
      </Badge>
    );
  }

  return (
    <Badge variant="outline" className="border-semantic-success-border bg-semantic-success-surface text-semantic-success">
      Concluída
    </Badge>
  );
}

type LeadTransfersTableProps = {
  onRowClick: (row: LeadTransferRow) => void;
};

export function LeadTransfersTable({ onRowClick }: LeadTransfersTableProps) {
  const { data, isLoading, filters, setPage, setFilter } = useLeadTransfersContext();

  if (isLoading && !data) {
    return (
      <div className="flex flex-col gap-2">
        {Array.from({ length: 8 }).map((_, index) => (
          <Skeleton key={index} className="h-12 w-full" />
        ))}
      </div>
    );
  }

  const rows = data?.items ?? [];
  const total = data?.total ?? 0;
  const totalPages = data?.totalPages ?? 1;

  return (
    <TooltipProvider delayDuration={0}>
      <div className="flex flex-col gap-4">
        <div className="rounded-lg border border-border/60">
          <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>E-mail</TableHead>
              <TableHead>Telefone</TableHead>
              <TableHead className="text-center">Status</TableHead>
              <TableHead className="text-center">Transferência</TableHead>
              <TableHead className="text-center">Pré-agendamento</TableHead>
              <TableHead className="text-center">Data transferência</TableHead>
              <TableHead className="text-center">SDR</TableHead>
              <TableHead className="text-center">Closer</TableHead>
              <TableHead className="text-center">Time destino</TableHead>
              <TableHead className="text-center">Transferido por</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={11} className="h-24 text-center text-muted-foreground">
                  Nenhuma transferência encontrada.
                </TableCell>
              </TableRow>
            ) : (
              rows.map((row) => (
                <TableRow
                  key={`${row.transferState}-${row.transferId ?? row.leadId}`}
                  className="cursor-pointer"
                  onClick={() => onRowClick(row)}
                >
                  <TableCell className="font-medium">{row.leadName}</TableCell>
                  <TableCell className="text-muted-foreground">{row.leadEmail ?? "—"}</TableCell>
                  <TableCell>{row.leadPhone ?? "—"}</TableCell>
                  <TableCell className="text-center">
                    <Badge
                      variant="outline"
                      className={cn("font-normal", getLeadStatusBadgeClass(row.leadStatus))}
                    >
                      {getLeadStatusLabel(row.leadStatus)}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-center">
                    <TransferStateBadge state={row.transferState} />
                  </TableCell>
                  <TableCell className="text-center text-sm text-muted-foreground">
                    {formatDateTime(row.preScheduledAt)}
                  </TableCell>
                  <TableCell className="text-center text-sm text-muted-foreground">
                    {formatDateTime(row.transferDate)}
                  </TableCell>
                  <TableCell className="text-center">
                    <MemberCell member={row.sdr} />
                  </TableCell>
                  <TableCell className="text-center">
                    <MemberCell member={row.closer} />
                  </TableCell>
                  <TableCell className="text-center">{row.destinationTeam?.name ?? "—"}</TableCell>
                  <TableCell className="text-center">
                    <MemberCell member={row.transferredBy} />
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span>Linhas por página</span>
          <SelectPageSize
            value={String(filters.pageSize)}
            onChange={(pageSize) => setFilter("pageSize", Number(pageSize))}
          />
          <span>
            Página {filters.page} de {totalPages} ({total} transferências)
          </span>
        </div>

        <div className="flex items-center gap-1">
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="size-8"
            disabled={filters.page <= 1}
            onClick={() => setPage(1)}
          >
            <ChevronsLeft />
          </Button>
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="size-8"
            disabled={filters.page <= 1}
            onClick={() => setPage(filters.page - 1)}
          >
            <ChevronLeft />
          </Button>
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="size-8"
            disabled={filters.page >= totalPages}
            onClick={() => setPage(filters.page + 1)}
          >
            <ChevronRight />
          </Button>
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="size-8"
            disabled={filters.page >= totalPages}
            onClick={() => setPage(totalPages)}
          >
            <ChevronsRight />
          </Button>
        </div>
        </div>
      </div>
    </TooltipProvider>
  );
}

function SelectPageSize({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="h-8 w-[72px]">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {["10", "20", "50"].map((size) => (
          <SelectItem key={size} value={size}>
            {size}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
