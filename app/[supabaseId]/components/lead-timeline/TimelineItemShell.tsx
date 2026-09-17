import type { ReactNode } from "react"
import type { LeadActivityResponseDTO } from "@/app/api/v1/leads/DTO/leadResponseDTO"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { cn } from "@/lib/utils"
import { formatActivityDate, getActivityInitials } from "./timeline-utils"

type TimelineItemShellProps = {
  activity: LeadActivityResponseDTO
  scheduleTimezone: string
  highlighted: boolean
  typeIcon: ReactNode
  typeLabel: string
  itemRef: (node: HTMLDivElement | null) => void
  children: ReactNode
  footer?: ReactNode
}

export function TimelineItemShell({
  activity,
  scheduleTimezone,
  highlighted,
  typeIcon,
  typeLabel,
  itemRef,
  children,
  footer,
}: TimelineItemShellProps) {
  const authorName = activity.author?.fullName || activity.author?.email || "Sistema"
  const initials = getActivityInitials(authorName)
  const fallbackEmail = activity.author?.email || "guest"
  const avatarSrc = activity.author?.avatarUrl || `https://avatar.vercel.sh/${fallbackEmail}.png`

  return (
    <div
      ref={itemRef}
      className={cn(
        "w-full rounded-lg border border-border/60 bg-muted/40 p-3 transition-colors",
        highlighted ? "bg-primary/5 ring-2 ring-primary/50" : ""
      )}
    >
      <div className="grid grid-cols-[auto_1fr] items-center-safe gap-x-3 gap-y-2">
        <Avatar className="size-6 rounded-lg border border-border/60">
          <AvatarImage src={avatarSrc} />
          <AvatarFallback className="rounded-lg text-[10px]">{initials || "LF"}</AvatarFallback>
        </Avatar>
        <div className="flex items-start justify-between gap-2">
          <span className="text-sm font-medium text-foreground">{authorName}</span>
          <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
            <span>{formatActivityDate(activity.createdAt, scheduleTimezone)}</span>
            <span className="inline-flex items-center">
              {typeIcon}
              <span className="sr-only">{typeLabel}</span>
            </span>
          </div>
        </div>
        {children}
        {footer}
      </div>
    </div>
  )
}
