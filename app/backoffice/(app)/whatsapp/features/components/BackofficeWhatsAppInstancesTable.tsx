"use client"

import { Eye, MoreHorizontal } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { useTimezone } from "@/app/context/TimezoneContext"
import { formatIntimezone } from "@/lib/dates/formatters"
import { maskPhone } from "@/lib/masks"
import { useBackofficeWhatsAppInstances } from "../context/BackofficeWhatsAppInstancesHook"
import { BackofficeWhatsAppInstanceStatusBadge } from "./BackofficeWhatsAppInstanceStatusBadge"

function formatDate(value: string | null, tz: string) {
  if (!value) return "—"
  return formatIntimezone(new Date(value), "dd/MM/yyyy HH:mm", tz)
}

export function BackofficeWhatsAppInstancesTable() {
  const { tz } = useTimezone()
  const { instances, isLoading, openDetail } = useBackofficeWhatsAppInstances()

  if (isLoading) {
    return (
      <div className="flex flex-col gap-2">
        {Array.from({ length: 5 }).map((_, index) => (
          <Skeleton key={index} className="h-12 w-full" />
        ))}
      </div>
    )
  }

  if (instances.length === 0) {
    return (
      <div className="rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground">
        Nenhuma instância WhatsApp encontrada.
      </div>
    )
  }

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Master</TableHead>
            <TableHead>Time</TableHead>
            <TableHead>Telefone</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Limite mensal</TableHead>
            <TableHead>Última conexão</TableHead>
            <TableHead className="w-12" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {instances.map((instance) => (
            <TableRow key={instance.id}>
              <TableCell>
                <div className="flex flex-col gap-0.5">
                  <span className="font-medium">
                    {instance.team.master.fullName ?? "—"}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {instance.team.master.email ?? "—"}
                  </span>
                </div>
              </TableCell>
              <TableCell>{instance.team.name}</TableCell>
              <TableCell>
                {instance.phoneNumber ? maskPhone(instance.phoneNumber) : "—"}
              </TableCell>
              <TableCell>
                <BackofficeWhatsAppInstanceStatusBadge status={instance.status} />
              </TableCell>
              <TableCell>{instance.usageLimitMonthly.toLocaleString("pt-BR")}</TableCell>
              <TableCell>{formatDate(instance.lastConnectedAt, tz)}</TableCell>
              <TableCell>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon">
                      <MoreHorizontal />
                      <span className="sr-only">Abrir menu</span>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => openDetail(instance.id)}>
                      <Eye data-icon="inline-start" />
                      Ver detalhes
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
