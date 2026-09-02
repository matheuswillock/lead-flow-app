"use client"

import { AlertCircle, Info } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { useCampanhasAnalytics } from "../context/useCampanhasAnalyticsHook"
import { formatCampaignAnalyticsInteger, formatCampaignAnalyticsRate } from "../utils/campaignAnalyticsFormatters"

function LeadsColumnHeader({ label, hint }: { label: string; hint: string }) {
  return (
    <span className="inline-flex items-center gap-1">
      {label}
      <Tooltip>
        <TooltipTrigger asChild>
          <button type="button" aria-label={hint} className="inline-flex text-muted-foreground">
            <Info className="size-3" aria-hidden="true" />
          </button>
        </TooltipTrigger>
        <TooltipContent className="max-w-56">{hint}</TooltipContent>
      </Tooltip>
    </span>
  )
}

export function CampanhasAnalyticsFormsTable() {
  const { formsFunnel, formsFunnelError, isUpdating, retry } = useCampanhasAnalytics()

  return (
    <Card>
      <CardHeader>
        <CardTitle>Formulários</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {formsFunnelError ? (
          <div
            role="alert"
            className="flex items-center justify-between rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive"
          >
            <span className="inline-flex items-center gap-2">
              <AlertCircle className="size-4" />
              {formsFunnelError}
            </span>
            <Button size="sm" variant="outline" onClick={() => void retry()}>
              Tentar novamente
            </Button>
          </div>
        ) : null}

        <div className="overflow-x-auto rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Time</TableHead>
                <TableHead>Formulário</TableHead>
                <TableHead className="text-right">Visualizações</TableHead>
                <TableHead className="text-right">Inícios</TableHead>
                <TableHead className="text-right">Conclusões</TableHead>
                <TableHead className="text-right">
                  <LeadsColumnHeader label="Criados" hint="Criado = card novo no CRM" />
                </TableHead>
                <TableHead className="text-right">
                  <LeadsColumnHeader label="Anexados" hint="Anexado = resposta somada a um card já existente" />
                </TableHead>
                <TableHead className="text-right">Taxa de início</TableHead>
                <TableHead className="text-right">Taxa de fechamento</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isUpdating || formsFunnelError ? (
                Array.from({ length: 4 }).map((_, index) => (
                  <TableRow key={`campanhas-analytics-forms-skeleton-${index}`}>
                    <TableCell colSpan={9}>
                      <Skeleton className="h-6 w-full" />
                    </TableCell>
                  </TableRow>
                ))
              ) : !formsFunnel || formsFunnel.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="py-8 text-center text-sm text-muted-foreground">
                    Nenhuma visualização de formulário no período selecionado.
                  </TableCell>
                </TableRow>
              ) : (
                formsFunnel.map((row) => (
                  <TableRow key={row.formId}>
                    <TableCell>{row.teamName}</TableCell>
                    <TableCell className="max-w-60 truncate" title={row.formName}>
                      {row.formName}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{formatCampaignAnalyticsInteger(row.viewed)}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatCampaignAnalyticsInteger(row.started)}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatCampaignAnalyticsInteger(row.completed)}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatCampaignAnalyticsInteger(row.leadCreated)}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatCampaignAnalyticsInteger(row.leadAttached)}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatCampaignAnalyticsRate(row.startRate)}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatCampaignAnalyticsRate(row.closeRate)}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  )
}
