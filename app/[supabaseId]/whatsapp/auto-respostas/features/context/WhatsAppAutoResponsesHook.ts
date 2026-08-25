"use client"

import { useCallback, useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { toastUserError } from '@/lib/ui/to-user-toast-message'
import { useTeamContext } from '@/app/context/TeamContext'
import { whatsAppAutoResponsesService } from '../services/WhatsAppAutoResponsesService'
import type {
  OffHoursSchedule,
  WhatsAppAutoResponseMatchMode,
  WhatsAppAutoResponseRule,
  WhatsAppAutoResponsesContextValue,
} from './WhatsAppAutoResponsesTypes'

const buildRequestKey = (teamId: string): string => `whatsapp-auto-responses:${teamId}`

export function useWhatsAppAutoResponses(supabaseId: string): WhatsAppAutoResponsesContextValue {
  const { activeTeamId } = useTeamContext()
  const [rules, setRules] = useState<WhatsAppAutoResponseRule[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isSaving, setIsSaving] = useState(false)

  const inFlightKeyRef = useRef<string | null>(null)
  const lastSuccessKeyRef = useRef<string | null>(null)
  const currentKeyRef = useRef<string | null>(null)

  const loadRules = useCallback(async () => {
    if (!activeTeamId) {
      setRules([])
      return
    }

    const requestKey = buildRequestKey(activeTeamId)
    currentKeyRef.current = requestKey
    if (inFlightKeyRef.current === requestKey) return

    setIsLoading(true)
    inFlightKeyRef.current = requestKey

    try {
      const fetched = await whatsAppAutoResponsesService.fetchRules(activeTeamId, supabaseId)
      if (currentKeyRef.current !== requestKey) return
      setRules(fetched)
      lastSuccessKeyRef.current = requestKey
    } catch (error) {
      console.error('[useWhatsAppAutoResponses] Erro ao carregar regras:', error)
      toastUserError(error)
    } finally {
      if (currentKeyRef.current === requestKey) setIsLoading(false)
      if (inFlightKeyRef.current === requestKey) inFlightKeyRef.current = null
    }
  }, [activeTeamId, supabaseId])

  useEffect(() => {
    lastSuccessKeyRef.current = null
    loadRules().catch((error) => {
      console.error('[useWhatsAppAutoResponses] Erro inesperado ao carregar regras:', error)
    })
  }, [loadRules])

  const updateRule = useCallback(
    async (
      ruleId: string,
      payload: Partial<{
        replyMessage: string
        triggerKeywords: string[]
        matchMode: WhatsAppAutoResponseMatchMode
        offHoursSchedule: OffHoursSchedule | null
        isActive: boolean
        priority: number
      }>
    ) => {
      if (!activeTeamId || isSaving) return

      setIsSaving(true)
      try {
        const updated = await whatsAppAutoResponsesService.updateRule(
          activeTeamId,
          supabaseId,
          ruleId,
          payload
        )
        setRules((prev) => prev.map((rule) => (rule.id === ruleId ? updated : rule)))
        toast.success('Regra salva com sucesso')
      } catch (error) {
        console.error('[useWhatsAppAutoResponses] Erro ao salvar regra:', error)
        toastUserError(error)
        throw error
      } finally {
        setIsSaving(false)
      }
    },
    [activeTeamId, supabaseId, isSaving]
  )

  const toggleRule = useCallback(
    async (ruleId: string, isActive: boolean) => {
      if (!activeTeamId || isSaving) return

      setIsSaving(true)
      try {
        const updated = await whatsAppAutoResponsesService.toggleRule(
          activeTeamId,
          supabaseId,
          ruleId,
          isActive
        )
        setRules((prev) => prev.map((rule) => (rule.id === ruleId ? updated : rule)))
        toast.success(isActive ? 'Regra ativada' : 'Regra desativada')
      } catch (error) {
        console.error('[useWhatsAppAutoResponses] Erro ao alternar regra:', error)
        toastUserError(error)
      } finally {
        setIsSaving(false)
      }
    },
    [activeTeamId, supabaseId, isSaving]
  )

  return {
    rules,
    isLoading,
    isSaving,
    activeTeamId,
    loadRules,
    updateRule,
    toggleRule,
  }
}
