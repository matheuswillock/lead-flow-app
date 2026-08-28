"use client"

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react"
import { useTeamContext } from "@/app/context/TeamContext"
import { useUser } from "@/app/context/UserContext"
import { useFeatureAccess } from "@/app/context/FeatureAccessContext"
import { FEATURE_SLUGS } from "@/lib/features/feature-slugs"
import { API_CLIENT_BASE } from "@/lib/route-map"
import { resolveCampaignDispatchTerminal } from "@/lib/email/campaign-dispatch-terminal"
import type {
  CampaignDispatchCompletionKind,
  CampaignDispatchProgress,
  CampaignDispatchProgressSummary,
} from "./CampanhasTypes"

export const CAMPAIGN_DISPATCH_TERMINAL_TTL_MS = 8_000

/**
 * Este provider NÃO usa Supabase Realtime. É polling, de propósito.
 *
 * Existia aqui um canal em `corretor_studio_email_campaigns` que nunca entregou
 * um evento sequer: a tabela não está na publicação `supabase_realtime`, e
 * nenhuma migration jamais a adicionou. Enumerando todas as sentenças de
 * pertencimento à publicação no repositório, a lista é
 * `lead_activities`, `lead_activity_reactions`, `notifications`,
 * `whatsapp_conversations`, `whatsapp_messages` — campanhas nunca esteve lá.
 *
 * O canal foi removido em vez de a tabela ser publicada. `corretor_studio_email_campaigns`
 * teve 398.542 updates na janela medida, de longe a tabela mais escrita do
 * banco; publicá-la geraria trabalho de WAL por linha, por subscriber, para
 * substituir um polling que já funciona.
 *
 * Se algum dia a entrega instantânea de progresso justificar o custo, o caminho
 * é publicar a tabela numa migration E reintroduzir o canal na mesma mudança —
 * canal sem publicação é código morto que aparenta cobertura.
 */

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
