"use client"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Ban, MoreVertical } from "lucide-react"
import { formatIntimezone } from "@/lib/dates"
import type { CloserBusyBlockItem } from "../services/ICloserBusyBlockService"

const WEEKDAY_LABELS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"]

type BusyBlockCardProps = {
  block: CloserBusyBlockItem
  timezone: string
  canManage: boolean
  onEdit: (block: CloserBusyBlockItem) => void
  onDelete: (block: CloserBusyBlockItem) => void
}

export function BusyBlockCard({
  block,
  timezone,
  canManage,
  onEdit,
  onDelete,
}: BusyBlockCardProps) {
  const start = new Date(block.occurrenceStartsAt ?? block.startsAt)
  const end = new Date(block.occurrenceEndsAt ?? block.endsAt)
  const closerLabel = block.closerName || block.closerEmail
  const weekdayLabel = block.isRecurring
    ? block.weekdays.map((day) => WEEKDAY_LABELS[day] ?? day).join(", ")
    : null

  return (
    <Card className="border-semantic-warning-border bg-semantic-warning-surface/40 shadow-none">
      <CardContent className="flex flex-col gap-3 p-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <Ban className="size-4 text-semantic-warning" />
            <p className="text-sm font-semibold">Ocupado</p>
            <Badge variant="outline">OCUPADO</Badge>
            {block.allDay && <Badge variant="secondary">Dia inteiro</Badge>}
            {block.isRecurring && <Badge variant="secondary">Recorrente</Badge>}
            <Badge variant="outline">
              {block.syncToGoogle ? "Studio + Google" : "Studio"}
            </Badge>
          </div>
          {canManage && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="size-7 shrink-0">
                  <MoreVertical className="size-4" />
                  <span className="sr-only">Ações da ocupação</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onSelect={() => onEdit(block)}>Editar</DropdownMenuItem>
                <DropdownMenuItem
                  className="text-destructive"
                  onSelect={() => onDelete(block)}
                >
                  Excluir
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>

        <div className="flex flex-col gap-1 text-sm">
          <p className="font-medium">{closerLabel}</p>
          <p className="text-muted-foreground">
            {block.allDay
              ? `${formatIntimezone(start, "dd/MM/yyyy", timezone)} → ${formatIntimezone(end, "dd/MM/yyyy", timezone)}`
              : `${formatIntimezone(start, "dd/MM/yyyy HH:mm", timezone)} → ${formatIntimezone(end, "HH:mm", timezone)}`}
          </p>
          {weekdayLabel && (
            <p className="text-xs text-muted-foreground">
              {weekdayLabel}
              {block.recurrenceEndsAt
                ? ` · até ${formatIntimezone(new Date(block.recurrenceEndsAt), "dd/MM/yyyy", timezone)}`
                : ""}
            </p>
          )}
          {block.reason && (
            <p className="text-xs text-muted-foreground">Motivo: {block.reason}</p>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
