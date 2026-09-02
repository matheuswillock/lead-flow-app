"use client"

import { useMemo, useState } from "react"
import { AlertCircle, ArrowDown, ArrowUp } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { useCampanhasAnalytics } from "../context/useCampanhasAnalyticsHook"
import { formatCampaignAnalyticsDateTime, formatCampaignAnalyticsInteger } from "../utils/campaignAnalyticsFormatters"
import type { CampaignAnalyticsDispatchRow } from "../context/CampanhasAnalyticsTypes"

const DISPATCHES_PAGE_SIZE_OPTIONS = [10, 25, 50, 100]

type SortableColumn = "totalSent" | "totalDelivered" | "totalOpened" | "totalClicked" | "totalBounced"

const SORT_COLUMNS: { key: SortableColumn; label: string }[] = [
  { key: "totalSent", label: "Enviados" },
  { key: "totalDelivered", label: "Entregues" },
  { key: "totalOpened", label: "Aberturas" },
  { key: "totalClicked", label: "Cliques" },
  { key: "totalBounced", label: "Bounces" },
]

function DispatchStatusBadge({ status }: { status: string }) {
  if (status === "failed") return <Badge variant="destructive">Falhou</Badge>
  if (status === "completed") return <Badge variant="secondary">Concluído</Badge>
  return <Badge variant="outline">{status}</Badge>
}

function sortRows(
  rows: CampaignAnalyticsDispatchRow[],
  sort: { column: SortableColumn; direction: "asc" | "desc" } | null
): CampaignAnalyticsDispatchRow[] {
  if (!sort) return rows
  const factor = sort.direction === "asc" ? 1 : -1
  return [...rows].sort((a, b) => (a[sort.column] - b[sort.column]) * factor)
}

export function CampanhasAnalyticsDispatchesTable() {
  const {
    dispatches,
    dispatchesError,
    isDispatchesLoading,
    setDispatchesPage,
    setDispatchesPageSize,
    retryDispatches,
  } = useCampanhasAnalytics()

  const [sort, setSort] = useState<{ column: SortableColumn; direction: "asc" | "desc" } | null>(null)

  const sortedRows = useMemo(() => sortRows(dispatches?.rows ?? [], sort), [dispatches?.rows, sort])

  function handleSort(column: SortableColumn) {
    setSort((previous) => {
      if (previous?.column !== column) return { column, direction: "desc" }
      return { column, direction: previous.direction === "desc" ? "asc" : "desc" }
    })
  }

  const totalPages = dispatches ? Math.max(1, Math.ceil(dispatches.total / dispatches.pageSize)) : 1

  return (
    <Card>
      <CardHeader>
        <CardTitle>Disparos do período</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {dispatchesError ? (
          <div
            role="alert"
            className="flex items-center justify-between rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive"
          >
            <span className="inline-flex items-center gap-2">
              <AlertCircle className="size-4" />
              {dispatchesError}
            </span>
            <Button size="sm" variant="outline" onClick={() => void retryDispatches()}>
              Tentar novamente
            </Button>
          </div>
        ) : null}

        <div className="overflow-x-auto rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Quando</TableHead>
                <TableHead>Time</TableHead>
                <TableHead>Template</TableHead>
                <TableHead>Status</TableHead>
                {SORT_COLUMNS.map((column) => (
                  <TableHead key={column.key} className="text-right">
                    <button
                      type="button"
                      onClick={() => handleSort(column.key)}
                      className="inline-flex items-center gap-1 font-medium hover:text-foreground"
                    >
                      {column.label}
                      {sort?.column === column.key ? (
                        sort.direction === "desc" ? (
                          <ArrowDown className="size-3" aria-hidden="true" />
                        ) : (
                          <ArrowUp className="size-3" aria-hidden="true" />
                        )
                      ) : null}
                    </button>
                  </TableHead>
                ))}
                <TableHead>Erro</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isDispatchesLoading || dispatchesError ? (
                Array.from({ length: 4 }).map((_, index) => (
                  <TableRow key={`campanhas-analytics-dispatches-skeleton-${index}`}>
                    <TableCell colSpan={9}>
                      <Skeleton className="h-6 w-full" />
                    </TableCell>
                  </TableRow>
                ))
              ) : sortedRows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="py-8 text-center text-sm text-muted-foreground">
                    Nenhum disparo no período selecionado.
                  </TableCell>
                </TableRow>
              ) : (
                sortedRows.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell className="whitespace-nowrap">{formatCampaignAnalyticsDateTime(row.dispatchedAt)}</TableCell>
                    <TableCell>{row.teamName}</TableCell>
                    <TableCell className="max-w-50 truncate" title={row.templateName}>
                      {row.templateName}
                    </TableCell>
                    <TableCell>
                      <DispatchStatusBadge status={row.status} />
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{formatCampaignAnalyticsInteger(row.totalSent)}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatCampaignAnalyticsInteger(row.totalDelivered)}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatCampaignAnalyticsInteger(row.totalOpened)}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatCampaignAnalyticsInteger(row.totalClicked)}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatCampaignAnalyticsInteger(row.totalBounced)}</TableCell>
                    <TableCell className="max-w-40 truncate text-destructive" title={row.errorMessage ?? undefined}>
                      {row.errorMessage ?? "—"}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        {dispatches && !dispatchesError ? (
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Resultados por página</span>
              <Select
                value={String(dispatches.pageSize)}
                onValueChange={(value) => setDispatchesPageSize(Number.parseInt(value, 10))}
                disabled={isDispatchesLoading}
              >
                <SelectTrigger className="w-20">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DISPATCHES_PAGE_SIZE_OPTIONS.map((option) => (
                    <SelectItem key={option} value={String(option)}>
                      {option}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setDispatchesPage(dispatches.page - 1)}
                disabled={dispatches.page <= 1 || isDispatchesLoading}
              >
                Anterior
              </Button>
              <span className="text-xs text-muted-foreground">
                Página {dispatches.page} de {totalPages}
              </span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setDispatchesPage(dispatches.page + 1)}
                disabled={dispatches.page >= totalPages || isDispatchesLoading}
              >
                Próxima
              </Button>
            </div>
          </div>
        ) : null}
      </CardContent>
    </Card>
  )
}
