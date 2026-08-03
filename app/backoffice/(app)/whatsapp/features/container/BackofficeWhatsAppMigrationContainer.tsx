"use client"

import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { useBackofficeWhatsAppInstances } from "../context/BackofficeWhatsAppInstancesHook"

export function BackofficeWhatsAppMigrationContainer() {
  const { instances, pagination } = useBackofficeWhatsAppInstances()

  const openWaCount = instances.filter((item) => item.engine === "OPENWA" || !item.engine).length
  const metaCount = instances.filter((item) => item.engine === "META").length

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="text-lg font-medium">Resumo de motores</h2>
        <p className="text-sm text-muted-foreground">
          Visibilidade da migração WhatsApp (OpenWA agora; Meta na Spec 03).
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-md border p-4">
          <div className="text-sm text-muted-foreground">OpenWA</div>
          <div className="text-2xl font-semibold">{openWaCount}</div>
          <div className="text-xs text-muted-foreground">
            na página atual ({pagination.totalItems} no total)
          </div>
        </div>
        <div className="rounded-md border p-4">
          <div className="text-sm text-muted-foreground">Meta</div>
          <div className="text-2xl font-semibold">{metaCount}</div>
          <div className="text-xs text-muted-foreground">disponível após Spec 03</div>
        </div>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Time</TableHead>
              <TableHead>Motor</TableHead>
              <TableHead>Status migração</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {instances.map((instance) => (
              <TableRow key={instance.id}>
                <TableCell>{instance.team.name}</TableCell>
                <TableCell>
                  <Badge variant="outline">{instance.engine || "OPENWA"}</Badge>
                </TableCell>
                <TableCell>
                  <Badge variant="secondary">Ativo</Badge>
                </TableCell>
              </TableRow>
            ))}
            {instances.length === 0 && (
              <TableRow>
                <TableCell colSpan={3} className="text-center text-muted-foreground">
                  Nenhuma instância para exibir.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <div className="rounded-md border border-border bg-muted/30 p-4 text-sm text-muted-foreground">
        Migração para Meta Cloud API disponível após gate de entrada da Spec 03 (≥ 20 times
        pagantes + 30 dias estáveis).
      </div>
    </div>
  )
}
