import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { useAnalyticsContext } from "../context/AnalyticsContext"

function safe(n: number, d: number) {
  return d === 0 ? 0 : Math.round((n / d) * 10000) / 100
}

export function CampaignComparisonTable() {
  const { data, loading } = useAnalyticsContext()

  const campaigns = data?.campaigns
    ? [...data.campaigns].sort((a, b) => b.totalSent - a.totalSent)
    : []

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Por Campanha</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <div className="rounded-b-lg overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Campanha</TableHead>
                <TableHead className="text-right">Enviados</TableHead>
                <TableHead className="text-right">Entregues</TableHead>
                <TableHead className="text-right">Abertos</TableHead>
                <TableHead className="text-right">Clicados</TableHead>
                <TableHead className="text-right">Bounces</TableHead>
                <TableHead className="text-right">Entregab.</TableHead>
                <TableHead className="text-right">Abertura</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                Array.from({ length: 4 }).map((_, i) => (
                  <TableRow key={i}>
                    {Array.from({ length: 8 }).map((__, j) => (
                      <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>
                    ))}
                  </TableRow>
                ))
              ) : campaigns.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="py-10 text-center text-sm text-muted-foreground">
                    Nenhuma campanha no período selecionado
                  </TableCell>
                </TableRow>
              ) : (
                campaigns.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell className="font-medium">{c.name}</TableCell>
                    <TableCell className="text-right text-sm">{c.totalSent.toLocaleString("pt-BR")}</TableCell>
                    <TableCell className="text-right text-sm">{c.totalDelivered.toLocaleString("pt-BR")}</TableCell>
                    <TableCell className="text-right text-sm">{c.totalOpened.toLocaleString("pt-BR")}</TableCell>
                    <TableCell className="text-right text-sm">{c.totalClicked.toLocaleString("pt-BR")}</TableCell>
                    <TableCell className="text-right text-sm">{c.totalBounced.toLocaleString("pt-BR")}</TableCell>
                    <TableCell className="text-right text-sm">
                      {safe(c.totalDelivered, c.totalSent).toFixed(1)}%
                    </TableCell>
                    <TableCell className="text-right text-sm">
                      {safe(c.totalOpened, c.totalDelivered).toFixed(1)}%
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
