"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { toast } from "sonner"
import { useParams } from "next/navigation"
import { useTeamContext } from "@/app/context/TeamContext"
import { useUserContext } from "@/app/context/UserContext"
import { toastUserError } from "@/lib/ui/to-user-toast-message"
import type { LandingDomain, LandingPageListItem, LandingPagesState } from "./LandingPagesTypes"
import { getEmailSettingsApiUrl, getLandingDomainApiUrl, getLandingPagesApiUrl } from "../services/LandingPagesService"

type ApiOutput<T> = { isValid?: boolean; errorMessages?: string[]; result?: T }
type LandingListResult = LandingPageListItem[]

function getErrorMessage(output: ApiOutput<unknown>, fallback: string) {
  return output.errorMessages?.[0] || fallback
}

export function useLandingPagesHook(): LandingPagesState {
  const { supabaseId } = useParams<{ supabaseId: string }>()
  const { activeTeamId } = useTeamContext()
  const { user } = useUserContext()
  const [items, setItems] = useState<LandingPageListItem[]>([])
  const [domain, setDomain] = useState<LandingDomain | null>(null)
  const [emailDomainName, setEmailDomainName] = useState<string | null>(null)
  const [emailDomainStatus, setEmailDomainStatus] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const headers = useMemo(
    () => ({
      "x-supabase-user-id": user?.supabaseId ?? supabaseId,
      "x-team-id": activeTeamId ?? "",
    }),
    [activeTeamId, supabaseId, user?.supabaseId],
  )

  const refresh = useCallback(async () => {
    if (!activeTeamId) return
    setIsLoading(true)
    setError(null)
    try {
      const [landingsResponse, domainResponse, emailSettingsResponse] = await Promise.all([
        fetch(getLandingPagesApiUrl(activeTeamId), { headers }),
        fetch(getLandingDomainApiUrl(activeTeamId), { headers }),
        fetch(getEmailSettingsApiUrl(), { headers }),
      ])
      const landingsOutput = (await landingsResponse.json()) as ApiOutput<LandingListResult>
      const domainOutput = (await domainResponse.json()) as ApiOutput<{ landingDomain: LandingDomain | null }>
      const emailSettingsOutput = (await emailSettingsResponse.json()) as ApiOutput<{ resendDomainName?: string | null; resendDomainStatus?: string | null }>
      if (!landingsResponse.ok || landingsOutput.isValid === false) {
        throw new Error(getErrorMessage(landingsOutput, "Não foi possível carregar as landing pages."))
      }
      setItems(landingsOutput.result ?? [])
      setDomain(domainOutput.result?.landingDomain ?? null)
      setEmailDomainName(emailSettingsOutput.result?.resendDomainName ?? null)
      setEmailDomainStatus(emailSettingsOutput.result?.resendDomainStatus ?? null)
    } catch (reason) {
      const message = reason instanceof Error ? reason.message : "Não foi possível carregar as landing pages."
      setError(message)
      setItems([])
    } finally {
      setIsLoading(false)
    }
  }, [activeTeamId, headers])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const runAction = useCallback(async (id: string, action: "publish" | "archive") => {
    if (!activeTeamId) return false
    try {
      const response = await fetch(`${getLandingPagesApiUrl(activeTeamId)}/${id}?action=${action}`, {
        method: "POST",
        headers,
      })
      const output = (await response.json()) as ApiOutput<unknown>
      if (!response.ok || output.isValid === false) throw new Error(getErrorMessage(output, "Não foi possível atualizar a landing page."))
      toast.success(action === "publish" ? "Landing publicada" : "Landing arquivada")
      await refresh()
      return true
    } catch (reason) {
      toastUserError(reason)
      return false
    }
  }, [activeTeamId, headers, refresh])

  const connectDomain = useCallback(async (hostname: string) => {
    if (!activeTeamId) return false
    try {
      const response = await fetch(getLandingDomainApiUrl(activeTeamId), {
        method: "POST",
        headers: { ...headers, "content-type": "application/json" },
        body: JSON.stringify({ hostname }),
      })
      const output = (await response.json()) as ApiOutput<{ landingDomain: LandingDomain }>
      if (!response.ok || output.isValid === false) throw new Error(getErrorMessage(output, "Não foi possível conectar o domínio."))
      toast.success("Domínio conectado")
      await refresh()
      return true
    } catch (reason) {
      toastUserError(reason)
      return false
    }
  }, [activeTeamId, headers, refresh])

  const verifyDomain = useCallback(async () => {
    if (!activeTeamId) return false
    try {
      const response = await fetch(getLandingDomainApiUrl(activeTeamId), {
        method: "PATCH",
        headers,
      })
      const output = (await response.json()) as ApiOutput<unknown>
      if (!response.ok || output.isValid === false) throw new Error(getErrorMessage(output, "Não foi possível verificar o domínio."))
      toast.success("Verificação solicitada")
      await refresh()
      return true
    } catch (reason) {
      toastUserError(reason)
      return false
    }
  }, [activeTeamId, headers, refresh])

  return { items, domain, emailDomainName, emailDomainStatus, isLoading, error, refresh, publish: (id) => runAction(id, "publish"), archive: (id) => runAction(id, "archive"), connectDomain, verifyDomain }
}
