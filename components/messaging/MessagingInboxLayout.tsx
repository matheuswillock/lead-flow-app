"use client"

import type { ReactNode } from "react"
import { cn } from "@/lib/utils"

export interface MessagingInboxLayoutProps {
  list: ReactNode
  panel: ReactNode
  className?: string
  innerClassName?: string
}

export function MessagingInboxLayout({
  list,
  panel,
  className,
  innerClassName,
}: MessagingInboxLayoutProps) {
  return (
    <div
      className={cn(
        "flex flex-1 overflow-hidden rounded-lg border border-border",
        className
      )}
    >
      <div className={cn("flex flex-1 overflow-hidden", innerClassName)}>
        {list}
        {panel}
      </div>
    </div>
  )
}
