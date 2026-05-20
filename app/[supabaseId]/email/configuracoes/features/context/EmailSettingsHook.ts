"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { toast } from "sonner"
import { EmailSettingsService } from "../services/EmailSettingsService"
import type { EmailSettings } from "./EmailSettingsTypes"

const service = new EmailSettingsService()

export type EmailSettingsHookReturn = {
  settings: EmailSettings | null
  loading: boolean
  saving: boolean
  fromName: string
  fromEmail: string
  replyTo: string
  setFromName: (v: string) => void
  setFromEmail: (v: string) => void
  setReplyTo: (v: string) => void
  handleSave: () => Promise<void>
}

export function useEmailSettings(): EmailSettingsHookReturn {
  const [settings, setSettings] = useState<EmailSettings | null>(null)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [fromName, setFromName] = useState("")
  const [fromEmail, setFromEmail] = useState("")
  const [replyTo, setReplyTo] = useState("")
  const fetchingRef = useRef(false)

  const fetchSettings = useCallback(async () => {
    if (fetchingRef.current) return
    fetchingRef.current = true
    setLoading(true)
    try {
      const result = await service.get()
      setSettings(result)
      setFromName(result.fromName)
      setFromEmail(result.fromEmail)
      setReplyTo(result.replyTo ?? "")
    } catch (err) {
      console.error("[useEmailSettings] fetchSettings error", err)
      toast.error("Erro ao carregar configurações de email")
    } finally {
      setLoading(false)
      fetchingRef.current = false
    }
  }, [])

  useEffect(() => {
    void fetchSettings()
  }, [fetchSettings])

  const handleSave = useCallback(async () => {
    if (!fromName.trim() || !fromEmail.trim()) {
      toast.error("Nome e email do remetente são obrigatórios")
      return
    }
    setSaving(true)
    try {
      const updated = await service.update({
        fromName: fromName.trim(),
        fromEmail: fromEmail.trim(),
        replyTo: replyTo.trim() || null,
      })
      setSettings(updated)
      toast.success("Configurações salvas com sucesso")
    } catch (err) {
      console.error("[useEmailSettings] handleSave error", err)
      toast.error("Erro ao salvar configurações")
    } finally {
      setSaving(false)
    }
  }, [fromName, fromEmail, replyTo])

  return {
    settings,
    loading,
    saving,
    fromName,
    fromEmail,
    replyTo,
    setFromName,
    setFromEmail,
    setReplyTo,
    handleSave,
  }
}
