"use client"

import { Fragment, useMemo } from "react"
import { cn } from "@/lib/utils"

const URL_PATTERN =
  /(?:https?:\/\/[^\s<]+[^\s<.,;:!?)\]"']|www\.[^\s<]+[^\s<.,;:!?)\]"'])/gi

const MENTION_PATTERN = /@(\d{8,})/g

export type WhatsAppContactLookup = Record<string, string>

function normalizeUrl(raw: string): string {
  const trimmed = raw.trim()
  if (trimmed.toLowerCase().startsWith("www.")) {
    return `https://${trimmed}`
  }
  return trimmed
}

type TextSegment =
  | { type: "text"; value: string }
  | { type: "url"; value: string; href: string }
  | { type: "mention"; value: string; opaqueId: string; displayName: string | null }

function parseSegments(text: string, contactLookup?: WhatsAppContactLookup): TextSegment[] {
  const combined = new RegExp(
    `${URL_PATTERN.source}|${MENTION_PATTERN.source}`,
    "gi"
  )

  const segments: TextSegment[] = []
  let lastIndex = 0
  let match: RegExpExecArray | null

  while ((match = combined.exec(text)) !== null) {
    const matched = match[0]
    const index = match.index

    if (index > lastIndex) {
      segments.push({ type: "text", value: text.slice(lastIndex, index) })
    }

    const opaqueId = match[1]
    if (opaqueId) {
      const displayName = contactLookup?.[opaqueId] ?? null
      segments.push({
        type: "mention",
        value: matched,
        opaqueId,
        displayName,
      })
    } else {
      const href = normalizeUrl(matched)
      segments.push({ type: "url", value: matched, href })
    }

    lastIndex = index + matched.length
  }

  if (lastIndex < text.length) {
    segments.push({ type: "text", value: text.slice(lastIndex) })
  }

  return segments.length > 0 ? segments : [{ type: "text", value: text }]
}

interface WhatsAppFormattedTextProps {
  text: string
  variant?: "inbound" | "outbound"
  contactLookup?: WhatsAppContactLookup
  className?: string
}

export function WhatsAppFormattedText({
  text,
  variant = "inbound",
  contactLookup,
  className,
}: WhatsAppFormattedTextProps) {
  const segments = useMemo(
    () => parseSegments(text, contactLookup),
    [text, contactLookup]
  )

  const isOutbound = variant === "outbound"
  const linkClass = isOutbound
    ? "font-medium text-primary-foreground underline break-all"
    : "font-medium text-primary underline break-all"
  const mentionClass = isOutbound
    ? "font-semibold text-primary-foreground"
    : "font-semibold text-primary"

  return (
    <p className={cn("text-sm leading-relaxed whitespace-pre-wrap", className)}>
      {segments.map((segment, index) => {
        if (segment.type === "text") {
          return <Fragment key={index}>{segment.value}</Fragment>
        }
        if (segment.type === "url") {
          return (
            <a
              key={index}
              href={segment.href}
              target="_blank"
              rel="noopener noreferrer"
              className={linkClass}
            >
              {segment.value}
            </a>
          )
        }
        const label = segment.displayName ? `@${segment.displayName}` : segment.value
        return (
          <span
            key={index}
            className={mentionClass}
            title={segment.displayName ? segment.value : undefined}
          >
            {label}
          </span>
        )
      })}
    </p>
  )
}

export function buildContactLookupFromList(
  contacts: Array<{ opaqueId: string; displayName: string | null; pushName: string | null }>
): WhatsAppContactLookup {
  const lookup: WhatsAppContactLookup = {}
  for (const contact of contacts) {
    const name = contact.displayName?.trim() || contact.pushName?.trim()
    if (name) {
      lookup[contact.opaqueId] = name
    }
  }
  return lookup
}
