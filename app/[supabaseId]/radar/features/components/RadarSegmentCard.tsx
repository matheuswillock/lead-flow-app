"use client"

import { Lock, MoreHorizontal, Pencil, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { cn } from "@/lib/utils"

type RadarSegmentCardProps = {
  name: string
  description: string | null
  count: number
  variant: "system" | "custom"
  mutationLock?: boolean
  onEdit?: () => void
  onDelete?: () => void
}

export function RadarSegmentCard({
  name,
  description,
  count,
  variant,
  mutationLock,
  onEdit,
  onDelete,
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
    </div>
  )
}
