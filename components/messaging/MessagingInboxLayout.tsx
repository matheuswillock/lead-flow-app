"use client"

import type { ReactNode } from "react"
import { cn } from "@/lib/utils"

export interface MessagingInboxLayoutProps {
  list: ReactNode
  panel: ReactNode
  className?: string
  innerClassName?: string
  /** When true on mobile, shows the conversation panel instead of the list. */
  showPanel?: boolean
}

export function MessagingInboxLayout({
  list,
  panel,
  className,
  innerClassName,
  showPanel = false,
}: MessagingInboxLayoutProps) {
  return (
    <div
      className={cn(
        "flex min-h-0 flex-1 overflow-hidden rounded-lg border border-border",
        className
      )}
    >
      <div className={cn("flex min-h-0 min-w-0 flex-1 overflow-hidden", innerClassName)}>
        <div
          className={cn(
            "flex min-h-0 w-full shrink-0 flex-col overflow-hidden border-border md:w-72 md:max-w-[23rem] md:border-r lg:w-80",
            showPanel ? "hidden md:flex" : "flex"
          )}
        >
          {list}
        </div>
        <div
          className={cn(
            "min-h-0 min-w-0 flex-1 flex-col overflow-hidden",
            showPanel ? "flex" : "hidden md:flex"
          )}
        >
          {panel}
        </div>
      </div>
    </div>
  )
}
