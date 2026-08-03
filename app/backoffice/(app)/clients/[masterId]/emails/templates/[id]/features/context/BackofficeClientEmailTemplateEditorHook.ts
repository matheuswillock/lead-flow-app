"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { toast } from "sonner"
import type {
  Template,
  TemplateEditorDraft,
  TemplateEditorMode,
  TemplateEditorState,
  TemplateTestRequest,
  TemplateVariable,
  TemplateVersionItem,
} from "@/app/[supabaseId]/email/templates/[id]/features/context/TemplateEditorTypes"
import type { ITemplateEditorStudioContext } from "@/components/email/template-editor/TemplateEditorStudioContext"
import type { IBackofficeClientEmailTemplateEditorService } from "../services/IBackofficeClientEmailTemplateEditorService"

const EMPTY_DRAFT: TemplateEditorDraft = {
  name: "",
  subject: "",
  previewText: "",
  html: "",
  mailyJson: null,
  editorMode: "html",
  variables: [],
}

function resolveEditorMode(_template: Template): TemplateEditorMode {
  return "html"
}

function createDraftFromTemplate(template: Template): TemplateEditorDraft {
  return {
    name: template.name,
    subject: template.subject,
    previewText: template.previewText ?? "",
    html: template.html ?? "",
    mailyJson: template.mailyJson ?? null,
    editorMode: resolveEditorMode(template),
    variables: template.variables ?? [],
  }
}

function hasPendingVariableReview(variables: TemplateVariable[]) {
  return variables.some((variable) => variable.reviewStatus === "pending")
}

export function useBackofficeClientEmailTemplateEditor(
  masterId: string,
  teamId: string | null,
  templateId: string,
  service: IBackofficeClientEmailTemplateEditorService
): ITemplateEditorStudioContext {
  const [template, setTemplate] = useState<Template | null>(null)
  const [draft, setDraft] = useState<TemplateEditorDraft>(EMPTY_DRAFT)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [templateApprovalRequired, setTemplateApprovalRequired] = useState(false)
  const [versions, setVersions] = useState<TemplateVersionItem[]>([])
  const [restoringVersionId, setRestoringVersionId] = useState<string | null>(null)
  const initialDraftRef = useRef<TemplateEditorDraft>(EMPTY_DRAFT)
  const isFetchingRef = useRef(false)
  const loadedKeyRef = useRef<string | null>(null)

  const isDirty = useMemo(
    () => JSON.stringify(draft) !== JSON.stringify(initialDraftRef.current),
    [draft]
  )

  const reloadTemplate = useCallback(async () => {
    if (!teamId) {
      setLoading(false)
      setError("teamId é obrigatório na URL.")
      return
    }

    const key = `${masterId}:${teamId}:${templateId}`
    if (isFetchingRef.current) return

    isFetchingRef.current = true
    setLoading(true)
    setError(null)

    try {
      const [nextTemplate, approvalSettings, versionsResult] = await Promise.all([
        service.getTemplate(masterId, teamId, templateId),
        service.getApprovalSettings(masterId, teamId),
        service.listVersions(masterId, teamId, templateId).catch(() => ({ versions: [] })),
      ])
      const nextDraft = createDraftFromTemplate(nextTemplate)
      setTemplate(nextTemplate)
      setDraft(nextDraft)
      setVersions(versionsResult.versions)
      setTemplateApprovalRequired(approvalSettings.templateApprovalRequired)
      initialDraftRef.current = nextDraft
      loadedKeyRef.current = key
    } catch (err) {
      const message = err instanceof Error ? err.message : "Erro ao carregar template"
      setError(message)
      toast.error(message)
    } finally {
      setLoading(false)
      isFetchingRef.current = false
    }
  }, [masterId, teamId, templateId, service])

  useEffect(() => {
    loadedKeyRef.current = null
    void reloadTemplate()
  }, [reloadTemplate])

  const updateDraft = useCallback((patch: Partial<TemplateEditorDraft>) => {
    setDraft((current) => ({ ...current, ...patch }))
  }, [])

  const setHtml = useCallback(
    (html: string) => updateDraft({ html }),
    [updateDraft]
  )

  const saveTemplate = useCallback(
    async (patch: Partial<TemplateEditorDraft> = {}) => {
      if (saving || !teamId) return null
      const draftToSave = { ...draft, ...patch }
      if (!draftToSave.name.trim() || !draftToSave.subject.trim()) {
        toast.error("Informe nome e assunto do template.")
        return null
      }

      setSaving(true)
      setError(null)
      try {
        const saved = await service.updateTemplate(masterId, teamId, templateId, draftToSave)
        const savedDraft = createDraftFromTemplate(saved)
        setTemplate(saved)
        setDraft(savedDraft)
        initialDraftRef.current = savedDraft
        toast.success("Rascunho salvo com sucesso")
        return saved
      } catch (err) {
        const message = err instanceof Error ? err.message : "Erro ao salvar template"
        setError(message)
        toast.error(message)
        return null
      } finally {
        setSaving(false)
      }
    },
    [draft, masterId, saving, service, teamId, templateId]
  )

  const publishTemplate = useCallback(
    async (id?: string) => {
      if (!teamId) return null
      if (hasPendingVariableReview(draft.variables)) {
        toast.error("Revise as variáveis pendentes antes de publicar.")
        return null
      }
      const targetId = id ?? template?.id
      if (!targetId) {
        toast.error("Salve o template antes de publicar.")
        return null
      }

      setSaving(true)
      setError(null)
      try {
        const published = await service.publishTemplate(masterId, teamId, targetId)
        const publishedDraft = createDraftFromTemplate(published)
        setTemplate(published)
        setDraft(publishedDraft)
        initialDraftRef.current = publishedDraft
        toast.success("Template publicado com sucesso")
        return published
      } catch (err) {
        const message = err instanceof Error ? err.message : "Erro ao publicar template"
        setError(message)
        toast.error(message)
        return null
      } finally {
        setSaving(false)
      }
    },
    [draft.variables, masterId, service, teamId, template?.id]
  )

  const unpublishTemplate = useCallback(async () => {
    if (saving || !teamId || !template?.id) return null

    setSaving(true)
    setError(null)
    try {
      const updated = await service.unpublishTemplate(masterId, teamId, template.id)
      const updatedDraft = createDraftFromTemplate(updated)
      setTemplate(updated)
      setDraft(updatedDraft)
      initialDraftRef.current = updatedDraft
      toast.success("Template movido para rascunho")
      return updated
    } catch (err) {
      const message = err instanceof Error ? err.message : "Erro ao despublicar template"
      setError(message)
      toast.error(message)
      return null
    } finally {
      setSaving(false)
    }
  }, [masterId, saving, service, teamId, template?.id])

  const submitForApproval = useCallback(async () => {
    if (saving || !teamId || !template?.id) return
    if (hasPendingVariableReview(draft.variables)) {
      toast.error("Revise as variáveis pendentes antes de enviar para aprovação.")
      return
    }

    setSaving(true)
    setError(null)
    try {
      const updated = await service.submitForApproval(masterId, teamId, template.id)
      const updatedDraft = createDraftFromTemplate(updated)
      setTemplate(updated)
      setDraft(updatedDraft)
      initialDraftRef.current = updatedDraft
      toast.success("Template enviado para aprovação")
    } catch (err) {
      const message = err instanceof Error ? err.message : "Erro ao enviar para aprovação"
      setError(message)
      toast.error(message)
    } finally {
      setSaving(false)
    }
  }, [draft.variables, masterId, saving, service, teamId, template?.id])

  const approveTemplate = useCallback(async () => {
    if (saving || !teamId || !template?.id) return

    setSaving(true)
    setError(null)
    try {
      const updated = await service.approveTemplate(masterId, teamId, template.id)
      const updatedDraft = createDraftFromTemplate(updated)
      setTemplate(updated)
      setDraft(updatedDraft)
      initialDraftRef.current = updatedDraft
      toast.success("Template aprovado")
    } catch (err) {
      const message = err instanceof Error ? err.message : "Erro ao aprovar template"
      setError(message)
      toast.error(message)
    } finally {
      setSaving(false)
    }
  }, [masterId, saving, service, teamId, template?.id])

  const rejectTemplate = useCallback(
    async (reviewNote: string) => {
      if (saving || !teamId || !template?.id) return

      setSaving(true)
      setError(null)
      try {
        const updated = await service.rejectTemplate(masterId, teamId, template.id, reviewNote)
        const updatedDraft = createDraftFromTemplate(updated)
        setTemplate(updated)
        setDraft(updatedDraft)
        initialDraftRef.current = updatedDraft
        toast.success("Template recusado")
      } catch (err) {
        const message = err instanceof Error ? err.message : "Erro ao recusar template"
        setError(message)
        toast.error(message)
      } finally {
        setSaving(false)
      }
    },
    [masterId, saving, service, teamId, template?.id]
  )

  const sendTestTemplate = useCallback(
    async (input: TemplateTestRequest) => {
      if (saving || !teamId) {
        toast.error("teamId é obrigatório na URL.")
        return
      }

      setSaving(true)
      setError(null)
      try {
        await service.sendTest(masterId, teamId, templateId, input)
        toast.success(`E-mail de teste enviado para ${input.to}`)
      } catch (err) {
        const message = err instanceof Error ? err.message : "Erro ao enviar e-mail de teste"
        setError(message)
        toast.error(message)
        throw err
      } finally {
        setSaving(false)
      }
    },
    [masterId, saving, service, teamId, templateId]
  )

  const restoreTemplateVersion = useCallback(
    async (versionId: string) => {
      if (restoringVersionId || saving || !teamId) return

      setRestoringVersionId(versionId)
      setError(null)
      try {
        const updated = await service.restoreVersion(masterId, teamId, templateId, versionId)
        const updatedDraft = createDraftFromTemplate(updated)
        setTemplate(updated)
        setDraft(updatedDraft)
        initialDraftRef.current = updatedDraft
        const versionsResult = await service.listVersions(masterId, teamId, updated.id)
        setVersions(versionsResult.versions)
        toast.success("HTML da versão recuperado no rascunho")
      } catch (err) {
        const message = err instanceof Error ? err.message : "Erro ao recuperar HTML da versão"
        setError(message)
        toast.error(message)
      } finally {
        setRestoringVersionId(null)
      }
    },
    [masterId, restoringVersionId, saving, service, teamId, templateId]
  )

  return {
    template,
    draft,
    loading,
    saving,
    error,
    isDirty,
    isNewTemplate: false,
    templateApprovalRequired,
    activeRole: "backoffice",
    reloadTemplate,
    saveTemplate,
    publishTemplate,
    unpublishTemplate,
    submitForApproval,
    approveTemplate,
    rejectTemplate,
    sendTestTemplate,
    restoreTemplateVersion,
    updateDraft,
    setHtml,
    versions,
    restoringVersionId,
  } satisfies TemplateEditorState & Omit<ITemplateEditorStudioContext, keyof TemplateEditorState>
}
