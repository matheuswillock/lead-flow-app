import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { formatDateTime } from "@/lib/dates"
import { DEFAULT_TZ } from "@/lib/dates/DEFAULT_TZ"
import { DispatchStatusBadge } from "./DispatchStatusBadge"
import type { AnalyticsData } from "../context/BackofficeEmailAnalyticsTypes"

type DispatchBreakdownTableProps = {
  data: AnalyticsData | null
  loading: boolean
}

export function DispatchBreakdownTable({ data, loading }: DispatchBreakdownTableProps) {
  if (loading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-5 w-40" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-40 w-full" />
        </CardContent>
      </Card>
    )
  }

  const dispatches = data?.dispatches ?? []

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Disparos da campanha</CardTitle>
      </CardHeader>
      <CardContent>
        {dispatches.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            Nenhum disparo no período selecionado.
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>#</TableHead>
                <TableHead>Data</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Entregabilidade</TableHead>
                <TableHead className="text-right">Abertura</TableHead>
                <TableHead className="text-right">Cliques</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {dispatches.map((dispatch) => (
                <TableRow key={dispatch.id}>
                  <TableCell>{dispatch.dispatchNumber}</TableCell>
                  <TableCell>{formatDateTime(dispatch.createdAt, DEFAULT_TZ)}</TableCell>
                  <TableCell>
                    <DispatchStatusBadge status={dispatch.status} />
                  </TableCell>
                  <TableCell className="text-right">
                    {dispatch.rates.deliverabilityRate.toFixed(1)}%
                  </TableCell>
                  <TableCell className="text-right">{dispatch.rates.openRate.toFixed(1)}%</TableCell>
                  <TableCell className="text-right">{dispatch.rates.clickRate.toFixed(1)}%</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  )
}
