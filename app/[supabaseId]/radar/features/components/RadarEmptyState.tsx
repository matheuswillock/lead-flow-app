"use client"

import { Inbox } from "lucide-react"
import { Button } from "@/components/ui/button"

type RadarEmptyStateProps = {
  title: string
  description: string
  actionLabel?: string
  onAction?: () => void
}

export function RadarEmptyState({ title, description, actionLabel, onAction }: RadarEmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center gap-4 rounded-xl border border-dashed p-12 text-center">
      <Inbox className="size-10 text-muted-foreground" />
      <div className="flex flex-col gap-1">
        <p className="font-medium">{title}</p>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      {actionLabel && onAction ? <Button onClick={onAction}>{actionLabel}</Button> : null}
    </div>
  )
}
