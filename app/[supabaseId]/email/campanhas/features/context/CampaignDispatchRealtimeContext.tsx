"use client"

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react"
import { useTeamContext } from "@/app/context/TeamContext"
import { useUser } from "@/app/context/UserContext"
import { createSupabaseBrowser } from "@/lib/supabase/browser"
import { API_CLIENT_BASE } from "@/lib/route-map"

export type SendingCampaign = {
  id: string
  name: string
  totalRecipients: number
  totalSent: number
}

type CampaignDispatchRealtimeState = {
  sendingCampaigns: SendingCampaign[]
}

const CampaignDispatchRealtimeContext = createContext<CampaignDispatchRealtimeState | undefined>(undefined)

type Props = {
  children: React.ReactNode
  supabaseId: string
}

export function CampaignDispatchRealtimeProvider({ children, supabaseId }: Props) {
  const { activeTeamId } = useTeamContext()
  const { user } = useUser()
  const [sendingCampaigns, setSendingCampaigns] = useState<SendingCampaign[]>([])
  const reconnectTimerRef = useRef<number | null>(null)
  const reconnectAttemptRef = useRef(0)

  const fetchSendingCampaigns = useCallback(async () => {
    if (!activeTeamId || !user?.id) return
    try {
      const params = new URLSearchParams({ page: "1", pageSize: "50", status: "sending" })
      const res = await fetch(`${API_CLIENT_BASE}/email/campaigns?${params}`, {
        headers: { "x-supabase-id": supabaseId },
        cache: "no-store",
      })
      if (!res.ok) return
      const json = (await res.json()) as {
        result?: {
          campaigns?: Array<{
            id: string
            name: string
            totalRecipients: number
            totalSent: number
            status: string
          }>
        }
      }
      const campaigns = json.result?.campaigns ?? []
      setSendingCampaigns(
        campaigns
          .filter((c) => c.status === "sending")
          .map((c) => ({
            id: c.id,
            name: c.name,
            totalRecipients: c.totalRecipients,
            totalSent: c.totalSent,
          }))
      )
    } catch (err) {
      console.error("[CampaignDispatchRealtime] Erro ao buscar campanhas em envio:", err)
    }
  }, [activeTeamId, user?.id, supabaseId])

  useEffect(() => {
    void fetchSendingCampaigns()
  }, [fetchSendingCampaigns])

  useEffect(() => {
    if (!activeTeamId || !user?.id) return

    const supabase = createSupabaseBrowser()
    if (!supabase) return

    type SupabaseChannel = ReturnType<typeof supabase.channel>
    let channel: SupabaseChannel | null = null
    let cancelled = false

    const clearReconnectTimer = () => {
      if (reconnectTimerRef.current !== null) {
        window.clearTimeout(reconnectTimerRef.current)
        reconnectTimerRef.current = null
      }
    }

    const teardownChannel = () => {
      if (channel) {
        void supabase.removeChannel(channel)
        channel = null
      }
    }

    const scheduleReconnect = (reason: string) => {
      if (cancelled || reconnectTimerRef.current !== null) return
      reconnectAttemptRef.current += 1
      const delayMs = Math.min(1000 * 2 ** (reconnectAttemptRef.current - 1), 10000)
      console.info(`[CampaignDispatchRealtime] Reagendando (${reason}) em ${delayMs}ms`)
      reconnectTimerRef.current = window.setTimeout(() => {
        reconnectTimerRef.current = null
        if (!cancelled) void setupRealtime()
      }, delayMs)
    }

    const setupRealtime = async () => {
      clearReconnectTimer()
      teardownChannel()

      let accessToken: string | null = null
      try {
        const sessionResult = await supabase.auth.getSession()
        accessToken = sessionResult.data.session?.access_token ?? null
      } catch {
        // silent — try fallback below
      }

      if (!accessToken) {
        try {
          const res = await fetch(`${API_CLIENT_BASE}/realtime/auth-token`, { cache: "no-store" })
          if (res.ok) {
            const result = (await res.json()) as { result?: { accessToken?: string } }
            accessToken = result?.result?.accessToken ?? null
          }
        } catch {
          // silent — scheduleReconnect handles retry
        }
      }

      if (!accessToken) {
        scheduleReconnect("MISSING_TOKEN")
        return
      }

      await supabase.realtime.setAuth(accessToken)
      if (cancelled) return

      const capturedTeamId = activeTeamId

      channel = supabase
        .channel(`campaign-dispatch-${capturedTeamId}-${Date.now()}`)
        .on(
          "postgres_changes",
          {
            event: "UPDATE",
            schema: "public",
            table: "corretor_studio_email_campaigns",
            filter: `teamId=eq.${capturedTeamId}`,
          },
          (payload) => {
            const row = payload.new as {
              id?: string
              name?: string
              status?: string
              totalRecipients?: number
              totalSent?: number
              teamId?: string
            }
            if (!row?.id || row.teamId !== capturedTeamId) return

            const { id, name = "", status: newStatus, totalSent = 0, totalRecipients = 0 } = row

            setSendingCampaigns((prev) => {
              if (newStatus === "sending") {
                const idx = prev.findIndex((c) => c.id === id)
                if (idx >= 0) {
                  const next = [...prev]
                  next[idx] = { ...next[idx], totalSent, totalRecipients }
                  return next
                }
                return [...prev, { id, name, totalRecipients, totalSent }]
              }
              return prev.filter((c) => c.id !== id)
            })
          }
        )
        .subscribe((status) => {
          if (status === "SUBSCRIBED") {
            reconnectAttemptRef.current = 0
          }
          if (status === "CHANNEL_ERROR") scheduleReconnect("CHANNEL_ERROR")
          if (status === "TIMED_OUT") scheduleReconnect("TIMED_OUT")
        })
    }

    void setupRealtime()

    return () => {
      cancelled = true
      clearReconnectTimer()
      teardownChannel()
    }
  }, [activeTeamId, user?.id])

  return (
    <CampaignDispatchRealtimeContext.Provider value={{ sendingCampaigns }}>
      {children}
    </CampaignDispatchRealtimeContext.Provider>
  )
}

export function useCampaignDispatchRealtime(): CampaignDispatchRealtimeState {
  const ctx = useContext(CampaignDispatchRealtimeContext)
  if (!ctx) throw new Error("useCampaignDispatchRealtime must be used within CampaignDispatchRealtimeProvider")
  return ctx
}
