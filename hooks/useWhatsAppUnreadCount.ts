"use client"

import { useCallback, useEffect, useRef, useState } from 'react'
import { createSupabaseBrowser } from '@/lib/supabase/browser'
import { useTeamContext } from '@/app/context/TeamContext'
import { useUserContext } from '@/app/context/UserContext'
import { WHATSAPP_UNREAD_CHANGED_EVENT } from '@/lib/whatsapp/unread-events'

export function useWhatsAppUnreadCount({ enabled }: { enabled: boolean }) {
  const { activeTeamId } = useTeamContext()
  const { user } = useUserContext()

  const [unreadMessages, setUnreadMessages] = useState(0)

  const activeTeamIdRef = useRef(activeTeamId)
  const userIdRef = useRef(user?.id)
  const refetchTimerRef = useRef<number | null>(null)
  const reconnectTimerRef = useRef<number | null>(null)
  const reconnectAttemptRef = useRef(0)

  useEffect(() => { activeTeamIdRef.current = activeTeamId }, [activeTeamId])
  useEffect(() => { userIdRef.current = user?.id }, [user?.id])

  const fetchCount = useCallback(async () => {
    const teamId = activeTeamIdRef.current
    const supabaseId = userIdRef.current
    if (!teamId || !supabaseId) return
    try {
      const res = await fetch(
        `/api/v1/teams/${encodeURIComponent(teamId)}/whatsapp/unread-count`,
        { headers: { 'x-supabase-user-id': supabaseId } }
      )
      if (!res.ok) return
      const data = await res.json() as Record<string, unknown>
      if (data?.isValid) {
        const result = data.result as Record<string, unknown> | undefined
        setUnreadMessages((result?.totalUnreadMessages as number | undefined) ?? 0)
      }
    } catch {}
  }, [])

  useEffect(() => {
    if (!enabled || !activeTeamId) {
      setUnreadMessages(0)
      return
    }
    void fetchCount()
  }, [enabled, activeTeamId, fetchCount])

  useEffect(() => {
    if (!enabled) return
    const onUnreadChanged = () => void fetchCount()
    window.addEventListener(WHATSAPP_UNREAD_CHANGED_EVENT, onUnreadChanged)
    return () => window.removeEventListener(WHATSAPP_UNREAD_CHANGED_EVENT, onUnreadChanged)
  }, [enabled, fetchCount])

  useEffect(() => {
    if (!enabled || !activeTeamId) return

    const supabase = createSupabaseBrowser()
    if (!supabase) return

    let cancelled = false
    let channel: ReturnType<typeof supabase.channel> | null = null

    const scheduleRefetch = () => {
      if (refetchTimerRef.current !== null) return
      refetchTimerRef.current = window.setTimeout(() => {
        refetchTimerRef.current = null
        void fetchCount()
      }, 600)
    }

    const scheduleReconnect = () => {
      if (cancelled || reconnectTimerRef.current !== null) return
      reconnectAttemptRef.current += 1
      const delay = Math.min(1000 * 2 ** (reconnectAttemptRef.current - 1), 10000)
      reconnectTimerRef.current = window.setTimeout(() => {
        reconnectTimerRef.current = null
        if (!cancelled) void setup()
      }, delay)
    }

    const setup = async () => {
      if (channel) { void supabase.removeChannel(channel); channel = null }

      let accessToken: string | null = null
      try {
        const session = await supabase.auth.getSession()
        accessToken = session.data.session?.access_token ?? null
      } catch {}

      if (!accessToken) {
        try {
          const res = await fetch('/api/v1/realtime/auth-token', { method: 'GET', cache: 'no-store' })
          if (res.ok) {
            const data = await res.json() as Record<string, unknown>
            const result = data?.result as Record<string, unknown> | undefined
            accessToken = typeof result?.accessToken === 'string' ? result.accessToken : null
          }
        } catch {}
      }

      if (!accessToken || cancelled) { scheduleReconnect(); return }
      await supabase.realtime.setAuth(accessToken)

      channel = supabase
        .channel(`whatsapp-unread-count-${activeTeamId}-${Date.now()}`)
        .on(
          'postgres_changes',
          { event: 'UPDATE', schema: 'public', table: 'whatsapp_conversations', filter: `teamId=eq.${activeTeamId}` },
          () => scheduleRefetch()
        )
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'whatsapp_conversations', filter: `teamId=eq.${activeTeamId}` },
          () => scheduleRefetch()
        )
        .subscribe((status) => {
          if (status === 'SUBSCRIBED') reconnectAttemptRef.current = 0
          if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') scheduleReconnect()
        })
    }

    void setup()

    return () => {
      cancelled = true
      if (channel) void supabase.removeChannel(channel)
      if (refetchTimerRef.current !== null) window.clearTimeout(refetchTimerRef.current)
      if (reconnectTimerRef.current !== null) window.clearTimeout(reconnectTimerRef.current)
    }
  }, [enabled, activeTeamId, fetchCount])

  return { unreadMessages }
}
