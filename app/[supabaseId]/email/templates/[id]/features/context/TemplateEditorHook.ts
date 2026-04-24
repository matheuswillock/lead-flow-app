'use client'

import type { Editor as TiptapEditor } from '@tiptap/core'
import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Template, EditorMode, TemplateEditorState } from './TemplateEditorTypes'
import { createTemplateEditorService } from '../services/TemplateEditorService'
import { templatePickerService } from '../services/TemplatePickerService'
import {
  createTemplateEditorAssetService,
} from '../services/TemplateEditorAssetService'
import type {
  GeneratedTemplateXAsset,
  GenerateTemplateXAssetInput,
  UploadedTemplateImageAsset,
} from '../services/ITemplateEditorAssetService'
import { applyHtmlToEditor } from '../utils/importHtml'

const service = createTemplateEditorService()
const assetService = createTemplateEditorAssetService()

interface UseTemplateEditorReturn extends TemplateEditorState {
  setMode: (mode: EditorMode) => void
  setName: (name: string) => void
  setSubject: (subject: string) => void
  setPreviewText: (previewText: string) => void
  setMailyJson: (json: unknown) => void
  setHtml: (html: string) => void
  setVisualEditorInstance: (editor: TiptapEditor | null) => void
  isTemplatePickerOpen: boolean
  openTemplatePicker: () => void
  closeTemplatePicker: () => void
  applyTemplate: (templateId: string) => Promise<void>
  uploadEditorImage: (file: File) => Promise<UploadedTemplateImageAsset>
  generateTemplateXAsset: (input: GenerateTemplateXAssetInput) => Promise<GeneratedTemplateXAsset>
  handleSave: () => Promise<void>
}

export function useTemplateEditor(
  supabaseId: string,
  templateId: string
): UseTemplateEditorReturn {
  const router = useRouter()
  const isNew = templateId === 'new'

  const [template, setTemplate] = useState<Template | null>(null)
  const [mode, setMode] = useState<EditorMode>('maily')
  const [name, setName] = useState('')
  const [subject, setSubject] = useState('')
  const [previewText, setPreviewText] = useState('')
  const [mailyJson, setMailyJson] = useState<unknown | null>(null)
  const [html, setHtml] = useState('')
  const [visualEditorInstance, setVisualEditorInstance] = useState<TiptapEditor | null>(null)
  const [loading, setLoading] = useState(!isNew)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isTemplatePickerOpen, setIsTemplatePickerOpen] = useState(false)

  useEffect(() => {
    if (isNew) return

    const load = async () => {
      setLoading(true)
      setError(null)
      try {
        console.info('[useTemplateEditor] Loading template', templateId)
        const data = await service.getById(templateId)
        setTemplate(data)
        setName(data.name)
        setSubject(data.subject)
        setPreviewText(data.previewText ?? '')
        setMailyJson(data.mailyJson)
        setHtml(data.html ?? '')
        setMode(data.mailyJson ? 'maily' : 'html')
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Erro ao carregar template'
        console.error('[useTemplateEditor] Failed to load template', err)
        setError(message)
        toast.error('Erro ao carregar template', { description: message })
      } finally {
        setLoading(false)
      }
    }

    load()
  }, [templateId, isNew])

  const handleSave = useCallback(async () => {
    if (!name.trim()) {
      toast.error('Nome obrigatório', { description: 'Informe um nome para o template.' })
      return
    }
    if (!subject.trim()) {
      toast.error('Assunto obrigatório', { description: 'Informe o assunto do email.' })
      return
    }

    setSaving(true)
    try {
      const payload = {
        name: name.trim(),
        subject: subject.trim(),
        previewText: previewText.trim() || undefined,
        mailyJson: mode === 'maily' ? mailyJson ?? undefined : undefined,
        html: mode === 'html' ? html || undefined : undefined,
      }

      if (isNew) {
        console.info('[useTemplateEditor] Creating new template')
        await service.create(payload)
        toast.success('Template criado com sucesso')
      } else {
        console.info('[useTemplateEditor] Updating template', templateId)
        const updated = await service.update(templateId, payload)
        setTemplate(updated)
        toast.success('Template salvo com sucesso')
      }

      router.push(`/${supabaseId}/email/templates`)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao salvar template'
      console.error('[useTemplateEditor] Failed to save template', err)
      toast.error('Erro ao salvar template', { description: message })
    } finally {
      setSaving(false)
    }
  }, [isNew, templateId, supabaseId, name, subject, previewText, mode, mailyJson, html, router])

  const uploadEditorImage = useCallback(async (file: File) => {
    return assetService.uploadImage(file)
  }, [])

  const generateTemplateXAsset = useCallback(async (input: GenerateTemplateXAssetInput) => {
    return assetService.generateXAsset(input)
  }, [])

  const openTemplatePicker = useCallback(() => {
    setIsTemplatePickerOpen(true)
  }, [])

  const closeTemplatePicker = useCallback(() => {
    setIsTemplatePickerOpen(false)
  }, [])

  const applyTemplate = useCallback(async (templateId: string) => {
    try {
      const content = await templatePickerService.getTemplateContent(templateId)

      if (content.mailyJson) {
        setMailyJson(content.mailyJson)
        setMode('maily')
        if (content.html) {
          setHtml(content.html)
        }
      } else if (content.html && visualEditorInstance) {
        setMode('maily')
        applyHtmlToEditor(visualEditorInstance, content.html)
      } else if (content.html) {
        toast.info('HTML legacy — import em breve')
      }

      if (content.subject?.trim()) {
        setSubject(content.subject)
      }

      if (content.previewText?.trim()) {
        setPreviewText(content.previewText)
      }

      setIsTemplatePickerOpen(false)
    } catch (applyError) {
      const message = applyError instanceof Error ? applyError.message : 'Erro ao aplicar template'
      toast.error('Erro ao aplicar template', { description: message })
    }
  }, [visualEditorInstance])

  return {
    template,
    mode,
    name,
    subject,
    previewText,
    mailyJson,
    html,
    loading,
    saving,
    error,
    setMode,
    setName,
    setSubject,
    setPreviewText,
    setMailyJson,
    setHtml,
    setVisualEditorInstance,
    isTemplatePickerOpen,
    openTemplatePicker,
    closeTemplatePicker,
    applyTemplate,
    uploadEditorImage,
    generateTemplateXAsset,
    handleSave,
  }
}
