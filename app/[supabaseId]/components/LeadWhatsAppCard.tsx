"use client"

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { format, parseISO } from 'date-fns'
import { ArrowRight, MessageCircle } from 'lucide-react'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'

interface LinkedConversation {
  id: string
  contactName: string | null
  contactPhone: string
  lastMessagePreview: string | null
  lastMessageAt: string | null
  unreadCount: number
}

interface LeadWhatsAppCardProps {
  leadId: string
  supabaseId: string
  teamId: string
  enabled?: boolean
}

function formatPreviewTime(dateStr: string | null): string {
  if (!dateStr) return ''
  try {
    return format(parseISO(dateStr), 'HH:mm')
  } catch {
    return ''
  }
}

export function LeadWhatsAppCard({ leadId, supabaseId, teamId, enabled = true }: LeadWhatsAppCardProps) {
  const [conversation, setConversation] = useState<LinkedConversation | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const inFlightRef = useRef(false)
  const lastLeadIdRef = useRef<string | null>(null)

  const fetchLinkedConversation = useCallback(async () => {
    if (inFlightRef.current || lastLeadIdRef.current === leadId) return

    inFlightRef.current = true
    setIsLoading(true)

    try {
      const params = new URLSearchParams({ leadId, limit: '1' })
      const res = await fetch(
        `/api/v1/teams/${encodeURIComponent(teamId)}/whatsapp/conversations?${params.toString()}`,
        { headers: { 'x-supabase-user-id': supabaseId } }
      )
      if (!res.ok) return
      const data = await res.json() as Record<string, unknown>
      if (!data?.isValid) return

      const result = data.result as { conversations: LinkedConversation[]; total: number } | undefined
      const first = result?.conversations?.[0] ?? null
      setConversation(first)
      lastLeadIdRef.current = leadId
    } catch {
      // silently ignore – card simply won't appear
    } finally {
      setIsLoading(false)
      inFlightRef.current = false
    }
  }, [leadId, teamId, supabaseId])

  useEffect(() => {
    if (!enabled) {
      setConversation(null)
      setIsLoading(false)
      lastLeadIdRef.current = null
      return
    }
    lastLeadIdRef.current = null
    void fetchLinkedConversation()
  }, [enabled, fetchLinkedConversation])

  if (isLoading) {
    return (
      <div className="space-y-2 pt-1">
        <Separator />
        <p className="text-xs font-medium text-muted-foreground">WhatsApp</p>
        <Skeleton className="h-12 w-full rounded-lg" />
      </div>
    )
  }

  if (!conversation) return null

  const displayName = conversation.contactName ?? conversation.contactPhone
  const time = formatPreviewTime(conversation.lastMessageAt)

  return (
    <div className="space-y-2 pt-1">
      <Separator />
      <p className="text-xs font-medium text-muted-foreground">WhatsApp</p>
      <Link
        href={`/${supabaseId}/whatsapp`}
        className="flex items-center gap-3 rounded-lg border border-border/60 bg-background/60 p-3 transition-colors hover:bg-accent"
      >
        <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10">
          <MessageCircle className="size-4 text-primary" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <span className="truncate text-sm font-medium">{displayName}</span>
            {time && <span className="shrink-0 text-[10px] text-muted-foreground">{time}</span>}
          </div>
          {conversation.lastMessagePreview && (
            <p className="truncate text-xs text-muted-foreground">{conversation.lastMessagePreview}</p>
          )}
        </div>
        {conversation.unreadCount > 0 && (
          <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-destructive text-[10px] font-semibold text-destructive-foreground">
            {conversation.unreadCount > 9 ? '9+' : conversation.unreadCount}
          </span>
        )}
        <ArrowRight className="size-3.5 shrink-0 text-muted-foreground" />
      </Link>
    </div>
  )
}
