"use client"

import type { HTMLAttributes, ReactNode } from "react"

import { cn } from "@/lib/utils"

export function FieldGroup({
  className,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("flex flex-col gap-4", className)} {...props} />
}

export function Field({
  className,
  label,
  hint,
  error,
  disabled,
  children,
}: {
  className?: string
  label: string
  hint?: string
  error?: string | null
  disabled?: boolean
  children: ReactNode
}) {
  return (
    <div
      className={cn("flex flex-col gap-1.5", className)}
      data-invalid={Boolean(error) ? "true" : undefined}
      data-disabled={disabled ? "true" : undefined}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-medium text-foreground">{label}</span>
        {hint ? <span className="text-xs text-muted-foreground">{hint}</span> : null}
      </div>
      {children}
      {error ? <span className="text-xs font-medium text-destructive">{error}</span> : null}
    </div>
  )
}
