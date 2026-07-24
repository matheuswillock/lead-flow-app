"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { toast } from "sonner"
import type { IBackofficeClientEmailTemplateEditorService } from "../services/IBackofficeClientEmailTemplateEditorService"
import type {
  BackofficeClientEmailTemplateEditorContextValue,
  StudioEmailTemplateDetail,
} from "./BackofficeClientEmailTemplateEditorTypes"

export function useBackofficeClientEmailTemplateEditor(
  masterId: string,
  teamId: string | null,
  templateId: string,
  service: IBackofficeClientEmailTemplateEditorService
): BackofficeClientEmailTemplateEditorContextValue {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [template, setTemplate] = useState<StudioEmailTemplateDetail | null>(null)
  const [name, setName] = useState("")
  const [subject, setSubject] = useState("")
  const [html, setHtml] = useState("")
  const [error, setError] = useState<string | null>(null)
  const inFlightRef = useRef(false)
  const loadedKeyRef = useRef<string | null>(null)

  const load = useCallback(async () => {
    if (!teamId) {
      setError("teamId é obrigatório na URL.")
      setLoading(false)
      return
    }
    const key = `${masterId}:${teamId}:${templateId}`
    if (inFlightRef.current || loadedKeyRef.current === key) return
    inFlightRef.current = true
    setLoading(true)
    setError(null)
    try {
      const result = await service.getTemplate(masterId, teamId, templateId)
      setTemplate(result)
      setName(result.name)
      setSubject(result.subject)
      setHtml(result.html ?? "")
      loadedKeyRef.current = key
    } catch (err) {
      const message = err instanceof Error ? err.message : "Erro ao carregar template"
      setError(message)
      toast.error(message)
    } finally {
      inFlightRef.current = false
      setLoading(false)
    }
  }, [masterId, teamId, templateId, service])

  useEffect(() => {
    void load()
  }, [load])

  const save = useCallback(async () => {
    if (!teamId || saving) return
    setSaving(true)
    try {
      const result = await service.updateTemplate(masterId, teamId, templateId, {
        name,
        subject,
        html,
      })
      setTemplate(result)
      toast.success("Template atualizado")
      loadedKeyRef.current = null
      await load()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao salvar template")
    } finally {
      setSaving(false)
    }
  }, [teamId, saving, service, masterId, templateId, name, subject, html, load])

  return {
    loading,
    saving,
    template,
    name,
    subject,
    html,
    error,
    load,
    save,
    setName,
    setSubject,
    setHtml,
  }
}
