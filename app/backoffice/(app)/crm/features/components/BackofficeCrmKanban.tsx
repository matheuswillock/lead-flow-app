"use client"

import { useState } from "react"
import { Mail, Phone, Plus } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import { useBackofficeCrm } from "../context/BackofficeCrmHook"
import {
  BACKOFFICE_CRM_COLUMNS,
  type BackofficeLeadItem,
  type BackofficeLeadStatusKey,
} from "../context/BackofficeCrmTypes"

const DRAG_PAYLOAD_TYPE = "application/x-backoffice-lead"

export function BackofficeCrmKanban() {
  const { leadsByColumn, openCreateDialog, openEditDialog, moveLead } = useBackofficeCrm()
  const [dragOverColumn, setDragOverColumn] = useState<BackofficeLeadStatusKey | null>(null)

  function onDragStart(
    e: React.DragEvent,
    leadId: string,
    from: BackofficeLeadStatusKey
  ) {
    e.dataTransfer.setData(DRAG_PAYLOAD_TYPE, JSON.stringify({ leadId, from }))
    e.dataTransfer.effectAllowed = "move"
  }

  function onDragOver(e: React.DragEvent, to: BackofficeLeadStatusKey) {
    e.preventDefault()
    e.dataTransfer.dropEffect = "move"
    if (dragOverColumn !== to) setDragOverColumn(to)
  }

  function onDragLeave(to: BackofficeLeadStatusKey) {
    if (dragOverColumn === to) setDragOverColumn(null)
  }

  function onDrop(e: React.DragEvent, to: BackofficeLeadStatusKey) {
    e.preventDefault()
    setDragOverColumn(null)
    const raw = e.dataTransfer.getData(DRAG_PAYLOAD_TYPE)
    if (!raw) return
    try {
      const { leadId, from } = JSON.parse(raw) as {
        leadId: string
        from: BackofficeLeadStatusKey
      }
      void moveLead(leadId, from, to)
    } catch {
      // payload inválido, ignora
    }
  }

  return (
    <div className="flex h-full min-h-0 w-full flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">CRM</h1>
          <p className="text-sm text-muted-foreground">
            Pipeline operacional do backoffice. Arraste os cards entre colunas para
            mudar o status.
          </p>
        </div>
        <Button onClick={openCreateDialog} className="gap-2">
          <Plus className="size-4" />
          Adicionar novo lead
        </Button>
      </div>

      <div className="grid auto-cols-[minmax(18rem,20rem)] grid-flow-col gap-4 overflow-x-auto pb-3 pr-2 flex-1 min-h-0 items-stretch">
        {BACKOFFICE_CRM_COLUMNS.map((column) => {
          const items = leadsByColumn[column.key] ?? []
          const isDropTarget = dragOverColumn === column.key
          return (
            <div
              key={column.key}
              className={cn(
                "flex h-full min-h-0 flex-col rounded-2xl border bg-card p-3 shadow-sm transition-colors",
                isDropTarget && "border-primary/60 bg-primary/5"
              )}
              onDragOver={(e) => onDragOver(e, column.key)}
              onDragLeave={() => onDragLeave(column.key)}
              onDrop={(e) => onDrop(e, column.key)}
            >
              <div className="mb-2 flex items-center justify-between rounded-md bg-primary px-2 py-1 text-primary-foreground h-12">
                <h2 className="text-sm font-semibold">{column.title}</h2>
                <Badge variant="secondary" className="rounded-full">
                  {items.length}
                </Badge>
              </div>

              <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto px-1 pr-2">
                {items.length === 0 && (
                  <div className="flex min-h-[120px] flex-1 items-center justify-center rounded-xl border border-dashed text-sm text-muted-foreground">
                    Solte aqui
                  </div>
                )}
                {items.map((lead) => (
                  <BackofficeLeadCard
                    key={lead.id}
                    lead={lead}
                    onDragStart={(e) => onDragStart(e, lead.id, column.key)}
                    onClick={() => openEditDialog(lead)}
                  />
                ))}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

interface CardProps {
  lead: BackofficeLeadItem
  onDragStart: (e: React.DragEvent) => void
  onClick: () => void
}

function BackofficeLeadCard({ lead, onDragStart, onClick }: CardProps) {
  return (
    <Card
      draggable
      onDragStart={onDragStart}
      onClick={onClick}
      className="cursor-grab bg-accent transition-shadow hover:shadow-md active:cursor-grabbing"
    >
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-semibold leading-tight">
          {lead.name}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-1 text-xs text-accent-foreground">
        {lead.email && (
          <div className="flex items-center gap-2">
            <Mail className="size-3" />
            <span className="truncate">{lead.email}</span>
          </div>
        )}
        {lead.phone && (
          <div className="flex items-center gap-2">
            <Phone className="size-3" />
            <span className="truncate">{lead.phone}</span>
          </div>
        )}
        {lead.notes && (
          <p className="line-clamp-3 pt-1 text-xs text-muted-foreground">
            {lead.notes}
          </p>
        )}
      </CardContent>
    </Card>
  )
}
