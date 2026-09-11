"use client"

import { AlertCircle } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { useCampanhasAnalytics } from "../context/useCampanhasAnalyticsHook"
import { formatCampaignAnalyticsInteger, formatCampaignAnalyticsRate } from "../utils/campaignAnalyticsFormatters"

export function CampanhasAnalyticsTemplatesTable() {
  const { templates, templatesError, isUpdating, retry } = useCampanhasAnalytics()

  return (
    <Card>
      <CardHeader>
        <CardTitle>Templates</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {templatesError ? (
          <div
            role="alert"
            className="flex items-center justify-between rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive"
          >
            <span className="inline-flex items-center gap-2">
              <AlertCircle className="size-4" />
              {templatesError}
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
                <TableHead>Template</TableHead>
                <TableHead className="text-right">Disparos</TableHead>
                <TableHead className="text-right">Enviados</TableHead>
                <TableHead className="text-right">Entregues</TableHead>
                <TableHead className="text-right">Abertos</TableHead>
                <TableHead className="text-right">Cliques</TableHead>
                <TableHead className="text-right">Bounces</TableHead>
                <TableHead className="text-right">Falhas</TableHead>
                <TableHead className="text-right">Abertura</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isUpdating || templatesError ? (
                Array.from({ length: 4 }).map((_, index) => (
                  <TableRow key={`campanhas-analytics-templates-skeleton-${index}`}>
                    <TableCell colSpan={9}>
                      <Skeleton className="h-6 w-full" />
                    </TableCell>
                  </TableRow>
                ))
              ) : !templates || templates.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="py-8 text-center text-sm text-muted-foreground">
                    Nenhum template disparado no período selecionado.
                  </TableCell>
                </TableRow>
              ) : (
                templates.map((row) => (
                  <TableRow key={`${row.teamId}-${row.templateName}`}>
                    <TableCell>{row.teamName}</TableCell>
                    <TableCell className="max-w-60 truncate" title={row.templateName}>
                      {row.templateName}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{formatCampaignAnalyticsInteger(row.dispatches)}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatCampaignAnalyticsInteger(row.sent)}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatCampaignAnalyticsInteger(row.delivered)}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatCampaignAnalyticsInteger(row.opened)}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatCampaignAnalyticsInteger(row.clicked)}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatCampaignAnalyticsInteger(row.bounced)}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatCampaignAnalyticsInteger(row.failed)}</TableCell>
                    <TableCell className="text-right">
                      <Badge variant={row.openRate === null ? "outline" : "secondary"} className="tabular-nums">
                        {formatCampaignAnalyticsRate(row.openRate)}
                      </Badge>
                    </TableCell>
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
