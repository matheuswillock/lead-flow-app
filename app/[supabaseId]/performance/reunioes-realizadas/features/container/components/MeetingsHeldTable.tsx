"use client";

import Link from "next/link";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getLeadStatusLabel } from "@/lib/lead-status";
import { useParams } from "next/navigation";
import { useMeetingsHeldContext } from "../../context/MeetingsHeldContext";

export function MeetingsHeldTable() {
  const params = useParams();
  const supabaseId = params.supabaseId as string;
  const { data, isLoading, filters, setPage } = useMeetingsHeldContext();

  if (isLoading && !data) {
    return (
      <div className="flex flex-col gap-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    );
  }

  const rows = data?.rows ?? [];
  const pagination = data?.pagination;

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Data/hora</TableHead>
              <TableHead>Lead</TableHead>
              <TableHead>SDR</TableHead>
              <TableHead>Closer</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground py-10">
                  Nenhuma reunião realizada no período selecionado
                </TableCell>
              </TableRow>
            ) : (
              rows.map((row) => {
                const meetingDate = row.meetingDate ? new Date(row.meetingDate) : null;
                return (
                  <TableRow key={`${row.leadId}-${row.meetingDate}`}>
                    <TableCell className="whitespace-nowrap num">
                      {meetingDate && !Number.isNaN(meetingDate.getTime())
                        ? format(meetingDate, "dd/MM/yyyy HH:mm", { locale: ptBR })
                        : "—"}
                    </TableCell>
                    <TableCell>
                      <Link
                        href={`/${supabaseId}/crm?leadId=${row.leadId}`}
                        className="font-medium hover:underline"
                      >
                        {row.leadName}
                      </Link>
                      <div className="text-xs text-muted-foreground">{row.leadCode}</div>
                    </TableCell>
                    <TableCell>{row.sdr?.name ?? "—"}</TableCell>
                    <TableCell>{row.closer?.name ?? "—"}</TableCell>
                    <TableCell>
                      <Badge variant="secondary">
                        {getLeadStatusLabel(row.status)}
                      </Badge>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {pagination && pagination.totalPages > 1 && (
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm text-muted-foreground">
            {pagination.totalRows} reunião(ões) · página {pagination.page} de {pagination.totalPages}
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={filters.page <= 1 || isLoading}
              onClick={() => setPage(filters.page - 1)}
            >
              <ChevronLeft data-icon="inline-start" />
              Anterior
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={filters.page >= pagination.totalPages || isLoading}
              onClick={() => setPage(filters.page + 1)}
            >
              Próxima
              <ChevronRight data-icon="inline-end" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
