"use client"

import type { LucideIcon } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { cn } from "@/lib/utils"

type EmailSettingsSectionCardProps = {
  icon: LucideIcon
  title: string
  description: string
  children: React.ReactNode
  contentClassName?: string
}

export function EmailSettingsSectionCard({
  icon: Icon,
  title,
  description,
  children,
  contentClassName,
}: EmailSettingsSectionCardProps) {
  return (
    <Card className="overflow-hidden rounded-[1.1rem] border-border/70 bg-[color:var(--surface-2)] shadow-[var(--precision-shadow-1)]">
      <CardHeader className="border-b border-border/60 bg-[color:var(--surface-1)] px-6 py-5">
        <div className="flex items-start gap-4">
          <div className="flex size-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Icon className="size-5" />
          </div>
          <div className="flex flex-1 flex-col gap-1">
            <CardTitle className="font-[family-name:var(--font-poppins)] text-base font-semibold tracking-[-0.01em]">
              {title}
            </CardTitle>
            <CardDescription className="text-sm leading-6 text-muted-foreground">
              {description}
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className={cn("px-6 py-6", contentClassName)}>{children}</CardContent>
    </Card>
  )
}
