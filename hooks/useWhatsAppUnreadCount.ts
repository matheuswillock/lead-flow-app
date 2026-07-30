"use client"

import { useCallback, useEffect, useRef, useState } from 'react'
import { useTeamContext } from '@/app/context/TeamContext'
import { useUserContext } from '@/app/context/UserContext'
import { WHATSAPP_UNREAD_CHANGED_EVENT } from '@/lib/whatsapp/unread-events'

export function useWhatsAppUnreadCount({ enabled }: { enabled: boolean }) {
  const { activeTeamId } = useTeamContext()
  const { user } = useUserContext()

  const [unreadMessages, setUnreadMessages] = useState(0)

  const activeTeamIdRef = useRef(activeTeamId)
  const userIdRef = useRef(user?.id)

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

  return { unreadMessages }
}
