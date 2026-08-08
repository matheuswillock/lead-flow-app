"use client"

import { Download, GitBranch, ListPlus, Lock, MoreHorizontal, Pencil, Trash2 } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { cn } from "@/lib/utils"
import type { RadarExportFormat } from "@/lib/radar/exportRadarProfiles"

type RadarSegmentCardProps = {
  name: string
  description: string | null
  count: number
  variant: "system" | "custom"
  isInactive?: boolean
  mutationLock?: boolean
  onViewProfiles?: () => void
  onCreateContactList?: () => void
  onExport?: (format: RadarExportFormat) => void
  onEdit?: () => void
  onDelete?: () => void
  onGenerateChild?: () => void
}

export function RadarSegmentCard({
  name,
  description,
  count,
  variant,
  isInactive,
  mutationLock,
  onViewProfiles,
  onCreateContactList,
  onExport,
  onEdit,
  onDelete,
  onGenerateChild,
}: RadarSegmentCardProps) {
  const isSystem = variant === "system"

  return (
    <div
      className={cn(
        "flex flex-col gap-2 rounded-xl border p-4",
        isSystem ? "bg-surface-2" : "bg-card"
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          {isSystem ? <Lock className="size-4 text-muted-foreground" /> : null}
          <h3 className="font-medium">{name}</h3>
          {isInactive ? <Badge variant="outline">Inativo</Badge> : null}
        </div>
        {!isSystem ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="size-8" disabled={mutationLock}>
                <MoreHorizontal />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={onEdit}>
                <Pencil data-icon="inline-start" />
                Editar
              </DropdownMenuItem>
              {onGenerateChild ? (
                <DropdownMenuItem onClick={onGenerateChild}>
                  <GitBranch data-icon="inline-start" />
                  Gerar segmento filho
                </DropdownMenuItem>
              ) : null}
              <DropdownMenuItem className="text-destructive" onClick={onDelete}>
                <Trash2 data-icon="inline-start" />
                Excluir
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : null}
      </div>
      {description ? <p className="text-sm text-muted-foreground">{description}</p> : null}
      <p className="font-display text-2xl font-semibold">{count}</p>
      <div className="flex flex-wrap gap-2">
        {onViewProfiles ? (
          <Button size="sm" variant="ghost" className="px-0" onClick={onViewProfiles}>
            Ver perfis
          </Button>
        ) : null}
        {onExport ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="sm" variant="outline" disabled={mutationLock || count === 0}>
                <Download data-icon="inline-start" />
                Exportar
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              <DropdownMenuItem onClick={() => onExport("csv")}>CSV</DropdownMenuItem>
              <DropdownMenuItem onClick={() => onExport("excel")}>Excel</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : null}
        {onCreateContactList ? (
          <Button
            size="sm"
            variant="outline"
            disabled={mutationLock || count === 0}
            onClick={onCreateContactList}
          >
            <ListPlus data-icon="inline-start" />
            Criar lista de contatos
          </Button>
        ) : null}
      </div>
    </div>
  )
}
