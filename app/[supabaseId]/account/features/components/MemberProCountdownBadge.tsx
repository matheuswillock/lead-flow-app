"use client"

import { useEffect, useState } from "react"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

const SECOND_MS = 1000
const MINUTE_MS = 60 * SECOND_MS
const HOUR_MS = 60 * MINUTE_MS
const DAY_MS = 24 * HOUR_MS

function formatRemaining(remainingMs: number): string {
  if (remainingMs <= DAY_MS) {
    const hours = Math.floor(remainingMs / HOUR_MS)
    const minutes = Math.floor((remainingMs % HOUR_MS) / MINUTE_MS)
    const seconds = Math.floor((remainingMs % MINUTE_MS) / SECOND_MS)
    return `${hours}h ${minutes}min ${seconds}s restantes`
  }

  const days = Math.floor(remainingMs / DAY_MS)
  const hours = Math.floor((remainingMs % DAY_MS) / HOUR_MS)
  const minutes = Math.floor((remainingMs % HOUR_MS) / MINUTE_MS)
  return `${days}d ${hours}h ${minutes}min restantes`
}

export function MemberProCountdownBadge({ expiresAt }: { expiresAt: string }) {
  const expiresAtMs = new Date(expiresAt).getTime()
  const [remainingMs, setRemainingMs] = useState(() => expiresAtMs - Date.now())

  useEffect(() => {
    const interval = setInterval(() => {
      const next = expiresAtMs - Date.now()
      setRemainingMs(next)
      if (next <= 0) clearInterval(interval)
    }, SECOND_MS)
    return () => clearInterval(interval)
  }, [expiresAtMs])

  if (remainingMs <= 0) return null

  return (
    <Badge
      variant="outline"
      className={cn(
        "font-normal normal-case",
        remainingMs <= DAY_MS ? "text-destructive" : "text-muted-foreground"
      )}
    >
      {formatRemaining(remainingMs)}
    </Badge>
  )
}
