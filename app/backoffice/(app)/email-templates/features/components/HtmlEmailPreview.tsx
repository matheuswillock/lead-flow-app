"use client"

import { useMemo } from "react"
import { cn } from "@/lib/utils"
import type { VariableFormItem } from "../services/IBackofficeEmailTemplatesService"

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

function substituteVariables(html: string, variables: VariableFormItem[]): string {
  let result = html
  for (const v of variables) {
    if (!v.key.trim()) continue
    const val = v.fallbackValue?.trim() || `[${v.key}]`
    result = result.replace(
      new RegExp(`\\{\\{\\{\\s*${escapeRegex(v.key.trim())}\\s*\\}\\}\\}`, "g"),
      val
    )
  }
  return result
}

interface Props {
  html: string
  variables: VariableFormItem[]
  className?: string
}

export function HtmlEmailPreview({ html, variables, className }: Props) {
  const rendered = useMemo(() => substituteVariables(html, variables), [html, variables])

  if (!html.trim()) {
    return (
      <div
        className={cn(
          "flex h-full items-center justify-center text-muted-foreground text-sm rounded-md border",
          className
        )}
      >
        Nenhum HTML para renderizar
      </div>
    )
  }

  return (
    <iframe
      srcDoc={rendered}
      sandbox="allow-same-origin"
      className={cn("w-full h-full border-0 bg-white rounded-md", className)}
      title="Preview do template de e-mail"
    />
  )
}
