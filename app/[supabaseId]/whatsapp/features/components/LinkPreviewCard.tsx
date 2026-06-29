"use client"

import { ExternalLink } from "lucide-react"
import { cn } from "@/lib/utils"
import type { WhatsAppMessage } from "../context/WhatsAppInboxTypes"

interface LinkPreviewCardProps {
  preview: NonNullable<WhatsAppMessage["linkPreview"]>
  className?: string
  variant?: "inbound" | "outbound"
}

export function LinkPreviewCard({ preview, className, variant = "inbound" }: LinkPreviewCardProps) {
  const isOutbound = variant === "outbound"
  const href = preview.url?.startsWith("http") ? preview.url : undefined

  const content = (
    <div
      className={cn(
        "mt-1 overflow-hidden rounded-md border text-left",
        isOutbound
          ? "border-primary-foreground/20 bg-primary-foreground/10"
          : "border-border bg-background/60",
        className
      )}
    >
      {preview.imageUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={preview.imageUrl}
          alt=""
          className="max-h-32 w-full object-cover"
        />
      )}
      <div className="flex flex-col gap-0.5 p-2">
        {preview.title && (
          <p className={cn("line-clamp-2 text-xs font-medium", isOutbound && "text-primary-foreground")}>
            {preview.title}
          </p>
        )}
        {preview.description && (
          <p
            className={cn(
              "line-clamp-2 text-[11px]",
              isOutbound ? "text-primary-foreground/80" : "text-muted-foreground"
            )}
          >
            {preview.description}
          </p>
        )}
        {href && (
          <span
            className={cn(
              "flex items-center gap-1 text-[10px]",
              isOutbound ? "text-primary-foreground/70" : "text-muted-foreground"
            )}
          >
            <ExternalLink className="size-3 shrink-0" />
            <span className="truncate">
              {(() => {
                try {
                  return new URL(href).hostname
                } catch {
                  return href
                }
              })()}
            </span>
          </span>
        )}
      </div>
    </div>
  )

  if (href) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" className="block no-underline">
        {content}
      </a>
    )
  }

  return content
}
