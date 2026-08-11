"use client"

import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import type { ContactListActiveImport } from "../context/ContatosTypes"
import {
  resolveContactImportProgressLabel,
  resolveContactImportStatusView,
} from "../utils/contact-import-status"

type ContactImportStatusBadgeProps = {
  activeImport: ContactListActiveImport
  compact?: boolean
  showProgress?: boolean
  className?: string
}

export function ContactImportStatusBadge({
  activeImport,
  compact = false,
  showProgress = false,
  className,
}: ContactImportStatusBadgeProps) {
  const view = resolveContactImportStatusView(activeImport, { compact })
  const progressLabel = showProgress
    ? resolveContactImportProgressLabel(activeImport)
    : null

  const showSecondary = Boolean(view.secondaryLabel) && !compact

  return (
    <div
      className={cn("flex flex-wrap items-center gap-1.5", className)}
      title={view.secondaryLabel ?? undefined}
    >
      <Badge
        variant={view.variant}
        className={cn(compact && "h-5 px-1.5 text-[10px]")}
      >
        {view.label}
      </Badge>
      {showSecondary ? (
        <Badge variant="outline">{view.secondaryLabel}</Badge>
      ) : null}
      {progressLabel && !compact ? (
        <span className="text-xs text-muted-foreground">{progressLabel}</span>
      ) : null}
    </div>
  )
}
