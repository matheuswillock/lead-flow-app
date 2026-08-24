"use client"

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react"
import { useTeamContext } from "@/app/context/TeamContext"
import { useUser } from "@/app/context/UserContext"
import { useFeatureAccess } from "@/app/context/FeatureAccessContext"
import { FEATURE_SLUGS } from "@/lib/features/feature-slugs"
import { createSupabaseBrowser } from "@/lib/supabase/browser"
import { shouldSkipRealtimeSubscribe } from "@/lib/supabase/realtime-guard"
import { API_CLIENT_BASE } from "@/lib/route-map"
import { resolveCampaignDispatchTerminal } from "@/lib/email/campaign-dispatch-terminal"
import { takeLeavingSendingSnapshot } from "./campaign-dispatch-leaving-snapshot"
import type {
  CampaignDispatchCompletionKind,
  CampaignDispatchProgress,
  CampaignDispatchProgressSummary,
} from "./CampanhasTypes"

export const CAMPAIGN_DISPATCH_TERMINAL_TTL_MS = 8_000

/**
 * Cadência do polling de progresso de disparo.
 *
 * Este provider vive no layout autenticado, então o intervalo rodava para todo
 * usuário logado em qualquer rota — inclusive quem nunca abriu o módulo de
 * e-mail, e inclusive em aba de fundo. A 4s isso dava 900 requisições por hora
 * por aba aberta.
 *
 * Os 4s continuam valendo enquanto existe campanha em `sending`, que é o caso
 * em que a barra de progresso precisa parecer fluida. Fora dele a cadência cai,
 * e em aba oculta o intervalo nem é armado.
 */
const SENDING_POLL_INTERVAL_MS = 4_000
const IDLE_POLL_INTERVAL_MS = 60_000

export type SendingCampaign = {
  id: string
  name: string
  totalRecipients: number
  totalSent: number
  acceptedCount?: number
  failedCount?: number
  completionKind?: CampaignDispatchCompletionKind
  dispatchId?: string | null
  retryFailedOnly?: boolean
  errorMessage?: string | null
  status?: "sending" | "completed" | "failed"
}

export type TerminalCampaign = SendingCampaign & {
  terminalUntil: number
  dispatchId: string
}

type CampaignDispatchRealtimeState = {
  sendingCampaigns: SendingCampaign[]
  terminalCampaigns: TerminalCampaign[]
}

const CampaignDispatchRealtimeContext = createContext<CampaignDispatchRealtimeState | undefined>(
  undefined
)

type Props = {
  children: React.ReactNode
  supabaseId: string
}

function mapCampaignRow(campaign: {
  id: string
  name: string
  totalRecipients: number
  totalSent: number
  status: string
  activeDispatch?: CampaignDispatchProgress | null
  latestDispatch?: CampaignDispatchProgress | null
  dispatchProgressSummary?: {
    totalRecipients: number
    acceptedCount: number
    failedCount: number
    completionKind: CampaignDispatchCompletionKind
    updatedAt: string
  } | null
}): SendingCampaign | null {
  if (campaign.status !== "sending" && !campaign.activeDispatch) {
    return null
  }

  const progress = campaign.activeDispatch
  const summary = campaign.dispatchProgressSummary
  const totalRecipients =
    progress?.totalRecipients ?? summary?.totalRecipients ?? campaign.totalRecipients
  const acceptedCount =
    progress?.acceptedCount ?? summary?.acceptedCount ?? campaign.totalSent

  return {
    id: campaign.id,
    name: campaign.name,
    totalRecipients,
    totalSent: acceptedCount,
    acceptedCount,
    failedCount: progress?.failedCount ?? summary?.failedCount ?? 0,
    completionKind: progress?.completionKind ?? summary?.completionKind ?? "pending",
    dispatchId: progress?.dispatchId ?? null,
    retryFailedOnly: progress?.retryFailedOnly ?? false,
    errorMessage: progress?.errorMessage ?? null,
    status: "sending",
  }
}

export function CampaignDispatchRealtimeProvider({ children, supabaseId }: Props) {
  const { activeTeamId } = useTeamContext()
  const { user } = useUser()
  const { hasAccess } = useFeatureAccess()
  const canSeeEmailCampaigns = hasAccess(FEATURE_SLUGS.EMAIL_CAMPAIGNS)
  const [sendingCampaigns, setSendingCampaigns] = useState<SendingCampaign[]>([])
  // Booleano em vez do array: rearma o intervalo quando entra/sai disparo,
  // e não a cada atualização de progresso da mesma campanha.
  const hasSendingCampaigns = sendingCampaigns.length > 0
  const [terminalCampaigns, setTerminalCampaigns] = useState<TerminalCampaign[]>([])
  const previousSendingRef = useRef<Map<string, SendingCampaign>>(new Map())
  const terminalTimersRef = useRef<Map<string, number>>(new Map())
  const reconnectTimerRef = useRef<number | null>(null)
  const reconnectAttemptRef = useRef(0)

  const promoteToTerminal = useCallback((campaign: SendingCampaign) => {
    const dispatchId = campaign.dispatchId ?? `campaign:${campaign.id}`
    const existingTimer = terminalTimersRef.current.get(dispatchId)
    if (existingTimer) window.clearTimeout(existingTimer)

    const terminalUntil = Date.now() + CAMPAIGN_DISPATCH_TERMINAL_TTL_MS
    setTerminalCampaigns((prev) => {
      const without = prev.filter((item) => item.dispatchId !== dispatchId)
      return [
        ...without,
        {
          ...campaign,
          dispatchId,
          terminalUntil,
          status: campaign.completionKind === "failed" ? "failed" : "completed",
        },
      ]
    })

    const timerId = window.setTimeout(() => {
      terminalTimersRef.current.delete(dispatchId)
      setTerminalCampaigns((prev) => prev.filter((item) => item.dispatchId !== dispatchId))
    }, CAMPAIGN_DISPATCH_TERMINAL_TTL_MS)
    terminalTimersRef.current.set(dispatchId, timerId)
  }, [])

  const resolveTerminalFromApi = useCallback(
    async (prev: SendingCampaign): Promise<SendingCampaign | null> => {
      try {
        const res = await fetch(`${API_CLIENT_BASE}/email/campaigns/${prev.id}`, {
          headers: {
            "x-supabase-id": supabaseId,
            "x-supabase-user-id": supabaseId,
          },
          cache: "no-store",
        })
        if (!res.ok) return null
        const json = (await res.json()) as {
          isValid?: boolean
          result?: {
            id: string
            name?: string
            status: string
            totalRecipients: number
            totalSent: number
            errorMessage?: string | null
            activeDispatch?: CampaignDispatchProgress | null
            latestDispatch?: CampaignDispatchProgress | null
            dispatchProgressSummary?: CampaignDispatchProgressSummary | null
          }
        }
        const campaign = json.result
        if (!campaign || json.isValid === false) return null

        const terminal = resolveCampaignDispatchTerminal(campaign)
        if (!terminal) return null

        return {
          ...prev,
          name: campaign.name || prev.name,
          totalRecipients: terminal.totalRecipients,
          totalSent: terminal.acceptedCount,
          acceptedCount: terminal.acceptedCount,
          failedCount: terminal.failedCount,
          completionKind: terminal.completionKind,
          dispatchId: terminal.dispatchId ?? prev.dispatchId,
          retryFailedOnly: terminal.retryFailedOnly,
          errorMessage: terminal.errorMessage,
          status: terminal.status,
        }
      } catch (err) {
        console.error("[CampaignDispatchRealtime] Erro ao resolver terminal do disparo:", err)
        return null
      }
    },
    [supabaseId]
  )

  const fetchSendingCampaigns = useCallback(async () => {
    if (!activeTeamId || !user?.id) return
    try {
      const params = new URLSearchParams({ page: "1", pageSize: "50", status: "sending" })
      const res = await fetch(`${API_CLIENT_BASE}/email/campaigns?${params}`, {
        headers: {
          "x-supabase-id": supabaseId,
          "x-supabase-user-id": supabaseId,
        },
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
            activeDispatch?: CampaignDispatchProgress | null
            latestDispatch?: CampaignDispatchProgress | null
            dispatchProgressSummary?: {
              totalRecipients: number
              acceptedCount: number
              failedCount: number
              completionKind: CampaignDispatchCompletionKind
              updatedAt: string
            } | null
          }>
        }
      }
      const campaigns = (json.result?.campaigns ?? [])
        .map(mapCampaignRow)
        .filter((campaign): campaign is SendingCampaign => Boolean(campaign))

      const nextMap = new Map(campaigns.map((campaign) => [campaign.id, campaign]))
      const disappeared: SendingCampaign[] = []
      for (const [id, prev] of previousSendingRef.current) {
        if (!nextMap.has(id)) {
          disappeared.push(prev)
        }
      }
      previousSendingRef.current = nextMap
      setSendingCampaigns(campaigns)

      // Polling-only path: never invent completed/full only because the row left status=sending.
      for (const prev of disappeared) {
        void resolveTerminalFromApi(prev).then((resolved) => {
          if (resolved) promoteToTerminal(resolved)
        })
      }
    } catch (err) {
      console.error("[CampaignDispatchRealtime] Erro ao buscar campanhas em envio:", err)
    }
  }, [activeTeamId, promoteToTerminal, resolveTerminalFromApi, user?.id, supabaseId])

  useEffect(() => {
    void fetchSendingCampaigns()
  }, [fetchSendingCampaigns])

  useEffect(() => {
    if (!activeTeamId || !user?.id) return
    // Sem acesso ao módulo de e-mail não há disparo para acompanhar.
    if (!canSeeEmailCampaigns) return

    let intervalId: number | null = null

    const clear = () => {
      if (intervalId !== null) {
        window.clearInterval(intervalId)
        intervalId = null
      }
    }

    const arm = () => {
      clear()
      // Aba oculta não desenha barra de progresso; rearmamos ao voltar.
      if (document.visibilityState !== "visible") return

      const periodMs = hasSendingCampaigns ? SENDING_POLL_INTERVAL_MS : IDLE_POLL_INTERVAL_MS
      intervalId = window.setInterval(() => {
        void fetchSendingCampaigns()
      }, periodMs)
    }

    const handleVisibilityChange = () => {
      // Ao voltar para a aba, busca uma vez na hora: o estado pode ter mudado
      // enquanto o intervalo estava desarmado.
      if (document.visibilityState === "visible") void fetchSendingCampaigns()
      arm()
    }

    arm()
    document.addEventListener("visibilitychange", handleVisibilityChange)

    return () => {
      clear()
      document.removeEventListener("visibilitychange", handleVisibilityChange)
    }
  }, [activeTeamId, canSeeEmailCampaigns, fetchSendingCampaigns, hasSendingCampaigns, user?.id])

  useEffect(() => {
    return () => {
      for (const timerId of terminalTimersRef.current.values()) {
        window.clearTimeout(timerId)
      }
      terminalTimersRef.current.clear()
    }
  }, [])

  useEffect(() => {
    if (shouldSkipRealtimeSubscribe()) return
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
              errorMessage?: string | null
            }
            if (!row?.id || row.teamId !== capturedTeamId) return

            const { id, name = "", status: newStatus, totalSent = 0, totalRecipients = 0 } = row

            if (newStatus === "sending") {
              setSendingCampaigns((prev) => {
                const idx = prev.findIndex((c) => c.id === id)
                if (idx >= 0) {
                  const next = [...prev]
                  next[idx] = {
                    ...next[idx],
                    totalSent,
                    totalRecipients,
                    acceptedCount: totalSent,
                    name: name || next[idx].name,
                  }
                  previousSendingRef.current.set(id, next[idx])
                  return next
                }
                const created: SendingCampaign = {
                  id,
                  name,
                  totalRecipients,
                  totalSent,
                  acceptedCount: totalSent,
                  status: "sending",
                  completionKind: "pending",
                }
                previousSendingRef.current.set(id, created)
                return [...prev, created]
              })
              return
            }

            // Leave sending: never invent completionKind from realtime row totals
            // (totalSent can lag acceptedCount). Resolve via GET + resolveCampaignDispatchTerminal
            // — same safe path as polling disappearance.
            // Snapshot do ref síncrono ANTES do setState (updater pode não rodar neste tick).
            const leavingSnapshot = takeLeavingSendingSnapshot(previousSendingRef.current, id, {
              name,
              errorMessage: row.errorMessage ?? null,
            })
            setSendingCampaigns((prev) => prev.filter((c) => c.id !== id))

            if (leavingSnapshot) {
              void resolveTerminalFromApi(leavingSnapshot).then((resolved) => {
                if (resolved) promoteToTerminal(resolved)
              })
            }

            // Aceleração: refetch lista sending (não substitui a resolução terminal acima)
            void fetchSendingCampaigns()
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
  }, [activeTeamId, fetchSendingCampaigns, promoteToTerminal, resolveTerminalFromApi, user?.id])

  return (
    <CampaignDispatchRealtimeContext.Provider value={{ sendingCampaigns, terminalCampaigns }}>
      {children}
    </CampaignDispatchRealtimeContext.Provider>
  )
}

export function useCampaignDispatchRealtime(): CampaignDispatchRealtimeState {
  const ctx = useContext(CampaignDispatchRealtimeContext)
  if (!ctx) {
    throw new Error("useCampaignDispatchRealtime must be used within CampaignDispatchRealtimeProvider")
  }
  return ctx
}
