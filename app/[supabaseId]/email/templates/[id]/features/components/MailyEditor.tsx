'use client'

import type { CSSProperties, ChangeEvent, FormEvent, HTMLAttributes, KeyboardEvent, ReactNode } from 'react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Editor } from '@maily-to/core'
import { getVariableSuggestions, ImageUploadExtension, VariableExtension } from '@maily-to/core/extensions'
import type { Editor as TiptapEditor, JSONContent } from '@tiptap/core'
import { Plus } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  buildPreviewDocument,
  buildXEmbedHtml,
  buildYoutubeEmbedHtml,
  extractYoutubeVideoId,
  getYoutubeThumbnailUrl,
  parseXPostUrl,
  USER_UPLOAD_IMAGE_ACCEPT,
  USER_UPLOAD_IMAGE_MIME_TYPES,
} from '@/lib/email-editor-embeds'
import { cn } from '@/lib/utils'
import { EditorEmptyState } from './EditorEmptyState'
import { EmailTemplatePickerDialog } from './EmailTemplatePickerDialog'
import { EmailCanvasFrame } from './EmailCanvasFrame'
import {
  buildMailySlashGroups,
  buildMailyVariableSuggestions,
  buildVariableNode,
  buildVariableToken,
  getMailyRailGroups,
  normalizeVariableKey,
  type MailyEditorActionDefinition,
  type MailyEditorModalKind,
} from './mailyEditorActions'
import { createResendSlashCommandExtension } from './mailyEditorSlash'
import type {
  GenerateTemplateXAssetInput,
  GeneratedTemplateXAsset,
  UploadedTemplateImageAsset,
} from '../services/ITemplateEditorAssetService'
import type { ITemplatePickerService } from '../services/ITemplatePickerService'
import type {
  LeadFlowVariableDefinition,
  LeadFlowVariableType,
  MailyPageStyle,
} from '../utils/emailPageStyle'
import { getLeadFlowMetadata, setLeadFlowVariables } from '../utils/emailPageStyle'
import { applyHtmlToEditor, attachHtmlPasteListener } from '../utils/importHtml'

type MailyTransitionDirection = 'enter-html' | 'return-to-canvas' | 'none'

const STRUCTURAL_NODE_TYPES = new Set(['doc', 'globalContent', 'container', 'paragraph'])

const EMPTY_VARIABLE_DRAFT: VariableDraft = {
  name: '',
  type: 'string',
  fallbackValue: '',
}

const EMPTY_YOUTUBE_DRAFT: YoutubeDraft = {
  url: '',
  includePlayButton: true,
}

const EMPTY_TWITTER_DRAFT: TwitterDraft = {
  url: '',
  darkMode: false,
}

interface VariableDraft {
  name: string
  type: LeadFlowVariableType
  fallbackValue: string
}

interface YoutubeDraft {
  url: string
  includePlayButton: boolean
}

interface TwitterDraft {
  url: string
  darkMode: boolean
}

interface PendingModalState {
  kind: MailyEditorModalKind
  editor: TiptapEditor | null
}

interface PendingFileActionState {
  actionId: string
  editor: TiptapEditor
  range?: { from: number; to: number } | null
}

function hasEditorContent(tree: unknown): boolean {
  if (!tree || typeof tree !== 'object') return false

  const stack: unknown[] = [tree]

  while (stack.length > 0) {
    const current = stack.pop()
    if (!current || typeof current !== 'object') continue

    const node = current as {
      type?: string
      text?: string
      content?: unknown[]
    }

    if (node.type === 'text' && typeof node.text === 'string' && node.text.trim().length > 0) {
      return true
    }

    if (node.type && !STRUCTURAL_NODE_TYPES.has(node.type) && node.type !== 'text') {
      return true
    }

    if (Array.isArray(node.content)) {
      for (const child of node.content) {
        stack.push(child)
      }
    }
  }

  return false
}

function serializeDocument(value: unknown) {
  try {
    return JSON.stringify(value ?? null)
  } catch {
    return ''
  }
}

function FloatingToolButton({
  active,
  children,
  className,
  ...props
}: HTMLAttributes<HTMLButtonElement> & { active?: boolean; children: ReactNode }) {
  return (
    <button
      type="button"
      className={cn(
        'flex h-10 w-10 items-center justify-center rounded-2xl border transition-colors',
        active
          ? 'border-[#2d3440] bg-[#20242d] text-white shadow-[0_8px_18px_rgba(0,0,0,0.34)]'
          : 'border-transparent bg-transparent text-white/58 hover:bg-[#171a21] hover:text-white/92',
        className
      )}
      {...props}
    >
      {children}
    </button>
  )
}

function ShortcutHint({ children }: { children: ReactNode }) {
  return (
    <span className="rounded-md border border-white/12 bg-white/8 px-1.5 py-0.5 text-[11px] font-medium text-white/52">
      {children}
    </span>
  )
}

function MenuActionButton({
  active,
  icon,
  label,
  description,
  onClick,
}: {
  active?: boolean
  icon: ReactNode
  label: string
  description?: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex w-full items-start gap-3 rounded-2xl border border-transparent px-3 py-2.5 text-left transition-colors',
        active ? 'bg-[#151a22]' : 'hover:bg-[#151a22]'
      )}
    >
      <span className="mt-0.5 inline-flex min-w-5 justify-center text-white/72">{icon}</span>
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="truncate text-[15px] font-medium text-white">{label}</span>
        {description ? <span className="text-[12px] leading-5 text-white/40">{description}</span> : null}
      </span>
    </button>
  )
}

function EmptyVariablesState({
  onCreate,
}: {
  onCreate: () => void
}) {
  return (
    <div className="flex flex-col gap-3 px-4 py-4">
      <p className="text-sm text-white/52">No variables available.</p>
      <button
        type="button"
        onClick={onCreate}
        className="flex items-center gap-2 rounded-2xl px-2 py-1.5 text-left text-base font-medium text-white transition-colors hover:bg-[#151a22]"
      >
        <Plus className="h-4 w-4" />
        <span>Create variable</span>
      </button>
    </div>
  )
}

function ImagePreviewSurface({
  src,
  alt,
  showPlayButton = false,
}: {
  src: string
  alt: string
  showPlayButton?: boolean
}) {
  return (
    <div className="overflow-hidden rounded-[18px] border border-white/10 bg-[#0a0c10] p-3">
      <div className="relative overflow-hidden rounded-[18px] border border-white/10 bg-black">
        <img src={src} alt={alt} className="block w-full rounded-[18px]" />
        {showPlayButton ? (
          <span className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <span className="relative h-[72px] w-[72px] rounded-full bg-[#ff0000] shadow-[0_10px_24px_rgba(0,0,0,0.28)]">
              <span className="absolute left-1/2 top-1/2 h-0 w-0 -translate-x-[38%] -translate-y-1/2 border-b-[14px] border-l-[22px] border-t-[14px] border-b-transparent border-l-white border-t-transparent" />
            </span>
          </span>
        ) : null}
      </div>
    </div>
  )
}

function HtmlEmbedPreviewSurface({
  html,
  title,
}: {
  html: string
  title: string
}) {
  return (
    <div className="overflow-hidden rounded-[18px] border border-white/10 bg-[#0a0c10] p-3">
      <iframe
        srcDoc={buildPreviewDocument(html)}
        className="h-[620px] w-full rounded-[18px] border-0 bg-white"
        sandbox="allow-same-origin allow-scripts allow-popups allow-popups-to-escape-sandbox"
        title={title}
      />
    </div>
  )
}

interface MailyEditorProps {
  value: unknown | null
  subject: string
  previewText: string
  pageStyle: MailyPageStyle
  transitionDirection: MailyTransitionDirection
  isTemplatePickerOpen: boolean
  onOpenTemplatePicker: () => void
  onTemplatePickerOpenChange: (open: boolean) => void
  onApplyTemplate: (templateId: string) => Promise<void>
  templatePickerService: ITemplatePickerService
  onChangeSubject: (value: string) => void
  onChangePreviewText: (value: string) => void
  onEditorInstanceChange: (editor: TiptapEditor | null) => void
  onUploadImage: (file: File) => Promise<UploadedTemplateImageAsset>
  onGenerateXAsset: (input: GenerateTemplateXAssetInput) => Promise<GeneratedTemplateXAsset>
  onChange: (json: unknown, html: string) => void
}

export function MailyEditor({
  value,
  subject,
  previewText,
  pageStyle,
  transitionDirection,
  isTemplatePickerOpen,
  onOpenTemplatePicker,
  onTemplatePickerOpenChange,
  onApplyTemplate,
  templatePickerService,
  onChangeSubject,
  onChangePreviewText,
  onEditorInstanceChange,
  onUploadImage,
  onGenerateXAsset,
  onChange,
}: MailyEditorProps) {
  const shouldAnimateReturn = transitionDirection === 'return-to-canvas'
  const [isExpanded, setIsExpanded] = useState(!shouldAnimateReturn)
  const [editorInstance, setEditorInstance] = useState<TiptapEditor | null>(null)
  const [isEditorEmpty, setIsEditorEmpty] = useState(() => !hasEditorContent(value))
  const [isEditorFocused, setIsEditorFocused] = useState(false)
  const [activeGroupId, setActiveGroupId] = useState<string | null>(null)
  const [hoveredGroupId, setHoveredGroupId] = useState<string | null>(null)
  const [pendingModal, setPendingModal] = useState<PendingModalState | null>(null)
  const [pendingFileAction, setPendingFileAction] = useState<PendingFileActionState | null>(null)
  const [variableDraft, setVariableDraft] = useState<VariableDraft>(EMPTY_VARIABLE_DRAFT)
  const [youtubeDraft, setYoutubeDraft] = useState<YoutubeDraft>(EMPTY_YOUTUBE_DRAFT)
  const [twitterDraft, setTwitterDraft] = useState<TwitterDraft>(EMPTY_TWITTER_DRAFT)
  const [isUploadingImage, setIsUploadingImage] = useState(false)
  const [imageUploadError, setImageUploadError] = useState<string | null>(null)
  const [isGeneratingXAsset, setIsGeneratingXAsset] = useState(false)
  const [twitterAssetError, setTwitterAssetError] = useState<string | null>(null)
  const [twitterGeneratedAsset, setTwitterGeneratedAsset] = useState<GeneratedTemplateXAsset | null>(null)
  const railRef = useRef<HTMLDivElement | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const htmlFileInputRef = useRef<HTMLInputElement | null>(null)
  const pasteCleanupRef = useRef<(() => void) | null>(null)
  const twitterGenerationRequestIdRef = useRef(0)
  const actionSelectionRef = useRef<
    (action: MailyEditorActionDefinition, context: { editor: TiptapEditor; range?: { from: number; to: number } | null }) => void
  >(() => undefined)

  const leadFlowMetadata = useMemo(() => getLeadFlowMetadata(value), [value])
  const railGroups = useMemo(() => getMailyRailGroups(leadFlowMetadata.variables), [leadFlowMetadata.variables])
  const variableSuggestions = useMemo(
    () => buildMailyVariableSuggestions(leadFlowMetadata.variables),
    [leadFlowMetadata.variables]
  )

  const showCommandsHelper = editorInstance ? isEditorEmpty && !isEditorFocused : !hasEditorContent(value)
  const activeGroup = railGroups.find((group) => group.id === activeGroupId) ?? null
  const currentValueSignature = useMemo(() => serializeDocument(value), [value])
  const editorBodyWidth = useMemo(
    () => `${Math.max(0, Math.floor(pageStyle.bodyWidth))}${pageStyle.bodyWidthUnit}`,
    [pageStyle.bodyWidth, pageStyle.bodyWidthUnit]
  )

  const youtubeVideoId = useMemo(() => extractYoutubeVideoId(youtubeDraft.url), [youtubeDraft.url])
  const youtubeThumbnailUrl = useMemo(
    () => (youtubeVideoId ? getYoutubeThumbnailUrl(youtubeVideoId) : null),
    [youtubeVideoId]
  )
  const youtubeUrlError =
    youtubeDraft.url.trim().length > 0 && !youtubeVideoId ? 'Invalid YouTube URL' : null

  const parsedXPost = useMemo(() => parseXPostUrl(twitterDraft.url), [twitterDraft.url])
  const xUrlError = twitterDraft.url.trim().length > 0 && !parsedXPost ? 'Invalid X post URL' : null

  const slashGroups = useMemo(
    () =>
      buildMailySlashGroups({
        variables: leadFlowMetadata.variables,
        onSelectAction: (action, context) => actionSelectionRef.current(action, context),
      }),
    [leadFlowMetadata.variables]
  )

  const slashExtensions = useMemo(
    () => [
      createResendSlashCommandExtension(slashGroups),
      ImageUploadExtension.configure({
        allowedMimeTypes: [...USER_UPLOAD_IMAGE_MIME_TYPES],
        onImageUpload: async (blob) => {
          const file =
            blob instanceof File ? blob : new File([blob], 'uploaded-image', { type: blob.type || USER_UPLOAD_IMAGE_MIME_TYPES[0] })
          const uploaded = await onUploadImage(file)
          return uploaded.publicUrl
        },
      }),
      VariableExtension.configure({
        suggestion: getVariableSuggestions(),
        variables: variableSuggestions,
      }),
    ],
    [onUploadImage, slashGroups, variableSuggestions]
  )

  useEffect(() => {
    if (!shouldAnimateReturn) {
      setIsExpanded(true)
      return
    }

    setIsExpanded(false)
    const frame = requestAnimationFrame(() => {
      setIsExpanded(true)
    })

    return () => {
      cancelAnimationFrame(frame)
    }
  }, [shouldAnimateReturn, transitionDirection])

  useEffect(() => {
    const handlePointerDown = (event: PointerEvent) => {
      if (!railRef.current?.contains(event.target as Node)) {
        setActiveGroupId(null)
        setHoveredGroupId(null)
      }
    }

    document.addEventListener('pointerdown', handlePointerDown)
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown)
    }
  }, [])

  useEffect(() => {
    if (!editorInstance || currentValueSignature.length === 0) {
      return
    }

    const editorSignature = serializeDocument(editorInstance.getJSON())
    if (editorSignature === currentValueSignature) {
      return
    }

    const nextContent = (value as JSONContent | null) ?? {
      type: 'doc',
      content: [{ type: 'paragraph', content: [] }],
    }

    editorInstance.commands.setContent(nextContent, false)
    setEditorInstance(editorInstance)
    setIsEditorEmpty(editorInstance.isEmpty)
  }, [currentValueSignature, editorInstance, value])

  useEffect(() => {
    if (!editorInstance) {
      return
    }

    onEditorInstanceChange(editorInstance)

    return () => {
      onEditorInstanceChange(null)
    }
  }, [editorInstance, onEditorInstanceChange])

  useEffect(() => {
    return () => {
      pasteCleanupRef.current?.()
      pasteCleanupRef.current = null
    }
  }, [])

  const syncEditorEmptyState = (editor: TiptapEditor) => {
    setEditorInstance(editor)
    setIsEditorEmpty(editor.isEmpty)
  }

  const resetTwitterGenerationState = () => {
    twitterGenerationRequestIdRef.current += 1
    setIsGeneratingXAsset(false)
    setTwitterAssetError(null)
    setTwitterGeneratedAsset(null)
  }

  const closeModal = () => {
    setPendingModal(null)
    resetTwitterGenerationState()
  }

  const attachFocusListeners = (editor: TiptapEditor) => {
    editor.on('focus', () => setIsEditorFocused(true))
    editor.on('blur', () => setIsEditorFocused(false))
  }

  const openContextModal = (kind: MailyEditorModalKind, editor: TiptapEditor | null) => {
    setActiveGroupId(null)
    setImageUploadError(null)
    setPendingModal({ kind, editor })

    if (kind === 'variable') {
      setVariableDraft(EMPTY_VARIABLE_DRAFT)
      resetTwitterGenerationState()
      return
    }

    if (kind === 'youtube') {
      setYoutubeDraft(EMPTY_YOUTUBE_DRAFT)
      resetTwitterGenerationState()
      return
    }

    setTwitterDraft(EMPTY_TWITTER_DRAFT)
    resetTwitterGenerationState()
  }

  const handleActionSelection = (
    action: MailyEditorActionDefinition,
    context: { editor: TiptapEditor; range?: { from: number; to: number } | null }
  ) => {
    if (action.mode === 'file') {
      if (isUploadingImage) {
        return
      }

      setActiveGroupId(null)
      setImageUploadError(null)
      setPendingFileAction({
        actionId: action.id,
        editor: context.editor,
        range: context.range,
      })

      if (fileInputRef.current) {
        fileInputRef.current.value = ''
        fileInputRef.current.click()
      }
      return
    }

    if (action.mode === 'modal') {
      if (context.range) {
        context.editor.chain().focus().deleteRange(context.range).run()
      }

      openContextModal(action.modalKind as MailyEditorModalKind, context.editor)
      return
    }

    action.run?.(context)
  }

  const handleImageFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0]

    if (!selectedFile) {
      setPendingFileAction(null)
      return
    }

    if (!USER_UPLOAD_IMAGE_MIME_TYPES.includes(selectedFile.type as (typeof USER_UPLOAD_IMAGE_MIME_TYPES)[number])) {
      const message = 'Unsupported image format. Use JPG, PNG, WEBP or GIF.'
      setImageUploadError(message)
      setPendingFileAction(null)
      toast.error('Invalid image', { description: message })
      event.target.value = ''
      return
    }

    const targetEditor = pendingFileAction?.editor ?? editorInstance

    if (!targetEditor) {
      setPendingFileAction(null)
      event.target.value = ''
      return
    }

    setIsUploadingImage(true)
    setImageUploadError(null)

    try {
      const uploaded = await onUploadImage(selectedFile)
      const chain = targetEditor.chain().focus()

      if (pendingFileAction?.range) {
        chain.deleteRange(pendingFileAction.range)
      }

      chain
        .setImage({
          src: uploaded.publicUrl,
          alt: uploaded.alt,
        })
        .run()
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to upload the selected image.'
      setImageUploadError(message)
      toast.error('Image upload failed', { description: message })
    } finally {
      setIsUploadingImage(false)
      setPendingFileAction(null)
      event.target.value = ''
    }
  }

  const handleHtmlFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0]

    if (!selectedFile) {
      return
    }

    if (!editorInstance) {
      toast.error('Erro ao importar HTML', { description: 'Editor visual indisponível no momento.' })
      event.target.value = ''
      return
    }

    try {
      const html = await selectedFile.text()
      applyHtmlToEditor(editorInstance, html)
      toast.success('HTML importado')
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Falha ao importar o arquivo HTML.'
      toast.error('Erro ao importar HTML', { description: message })
    } finally {
      event.target.value = ''
    }
  }

  actionSelectionRef.current = handleActionSelection

  useEffect(() => {
    if (pendingModal?.kind !== 'twitter') {
      twitterGenerationRequestIdRef.current += 1
      setIsGeneratingXAsset(false)
      setTwitterAssetError(null)
      setTwitterGeneratedAsset(null)
      return
    }

    if (!parsedXPost) {
      setIsGeneratingXAsset(false)
      setTwitterAssetError(null)
      setTwitterGeneratedAsset(null)
      return
    }

    const requestId = twitterGenerationRequestIdRef.current + 1
    twitterGenerationRequestIdRef.current = requestId
    setIsGeneratingXAsset(true)
    setTwitterAssetError(null)

    const timeoutId = window.setTimeout(() => {
      void (async () => {
        try {
          const generatedAsset = await onGenerateXAsset({
            url: parsedXPost.canonicalUrl,
            theme: twitterDraft.darkMode ? 'dark' : 'light',
          })

          if (twitterGenerationRequestIdRef.current !== requestId) {
            return
          }

          setTwitterGeneratedAsset(generatedAsset)
        } catch (error) {
          if (twitterGenerationRequestIdRef.current !== requestId) {
            return
          }

          const message = error instanceof Error ? error.message : 'Failed to generate the X preview asset.'
          setTwitterGeneratedAsset(null)
          setTwitterAssetError(message)
        } finally {
          if (twitterGenerationRequestIdRef.current === requestId) {
            setIsGeneratingXAsset(false)
          }
        }
      })()
    }, 280)

    return () => {
      clearTimeout(timeoutId)
    }
  }, [onGenerateXAsset, parsedXPost?.canonicalUrl, pendingModal?.kind, twitterDraft.darkMode])

  const handleRailActionClick = (action: MailyEditorActionDefinition) => {
    if (!editorInstance) {
      return
    }

    handleActionSelection(action, { editor: editorInstance, range: null })
  }

  const handleVariableSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    const editor = pendingModal?.editor ?? editorInstance
    const normalizedKey = normalizeVariableKey(variableDraft.name)

    if (!editor || normalizedKey.length === 0) {
      return
    }

    const nextVariable: LeadFlowVariableDefinition = {
      key: normalizedKey,
      type: variableDraft.type,
      fallbackValue: variableDraft.fallbackValue.trim() || undefined,
    }

    const existingVariables = leadFlowMetadata.variables.filter(
      (variable) => variable.key.toLowerCase() !== normalizedKey
    )
    const nextVariables = [...existingVariables, nextVariable]
    const nextDoc = setLeadFlowVariables(editor.getJSON(), nextVariables)

    editor.commands.setContent(nextDoc as JSONContent, false)
    editor
      .chain()
      .focus()
      .insertContent([buildVariableNode(nextVariable), { type: 'text', text: ' ' }])
      .run()

    closeModal()
  }

  const handleYoutubeSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    const editor = pendingModal?.editor ?? editorInstance
    if (!editor || !youtubeVideoId || !youtubeThumbnailUrl || youtubeUrlError) {
      return
    }

    editor
      .chain()
      .focus()
      .insertContent(
        {
          type: 'htmlCodeBlock',
          attrs: {
            language: 'html',
            activeTab: 'preview',
            showIfKey: null,
          },
          content: [
            {
              type: 'text',
              text: buildYoutubeEmbedHtml({
                url: youtubeDraft.url.trim(),
                thumbnailUrl: youtubeThumbnailUrl,
                includePlayButton: youtubeDraft.includePlayButton,
              }),
            },
          ],
        },
        { updateSelection: true }
      )
      .run()

    closeModal()
  }

  const handleTwitterSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    const editor = pendingModal?.editor ?? editorInstance
    if (!editor || !parsedXPost || !twitterGeneratedAsset) {
      return
    }

    editor
      .chain()
      .focus()
      .insertContent(
        {
          type: 'htmlCodeBlock',
          attrs: {
            language: 'html',
            activeTab: 'preview',
            showIfKey: null,
          },
          content: [
            {
              type: 'text',
              text: buildXEmbedHtml({
                url: parsedXPost.canonicalUrl,
                imageUrl: twitterGeneratedAsset.imageUrl,
                altText: `X post from @${parsedXPost.handle}`,
              }),
            },
          ],
        },
        { updateSelection: true }
      )
      .run()

    closeModal()
  }

  const handleModalShortcut = (
    event: KeyboardEvent<HTMLFormElement>,
    submit: (event: FormEvent<HTMLFormElement>) => void
  ) => {
    if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
      event.preventDefault()
      submit(event as unknown as FormEvent<HTMLFormElement>)
    }
  }

  return (
    <div className="relative flex h-full min-h-0 flex-1 overflow-hidden bg-[#0b0b0f]">
      <input
        ref={fileInputRef}
        type="file"
        accept={USER_UPLOAD_IMAGE_ACCEPT}
        className="hidden"
        onChange={handleImageFileChange}
      />
      <input
        ref={htmlFileInputRef}
        type="file"
        accept=".html,.htm,text/html"
        aria-label="Importar arquivo HTML"
        className="hidden"
        onChange={handleHtmlFileChange}
      />

      <EmailTemplatePickerDialog
        open={isTemplatePickerOpen}
        onOpenChange={onTemplatePickerOpenChange}
        onSelect={onApplyTemplate}
        service={templatePickerService}
      />

      <EmailCanvasFrame
        subject={subject}
        previewText={previewText}
        pageStyle={pageStyle}
        onChangeSubject={onChangeSubject}
        onChangePreviewText={onChangePreviewText}
        surface="visual"
        style={{
          width: isExpanded ? '100%' : '72%',
          opacity: isExpanded ? 1 : 0.9,
          transform: isExpanded ? 'translateX(0)' : 'translateX(6%)',
          transition: shouldAnimateReturn
            ? 'width 320ms ease-out, opacity 320ms ease-out, transform 320ms ease-out'
            : undefined,
        }}
      >
        <div className="relative flex min-h-0 flex-1 border-t px-4 pb-6">
          {showCommandsHelper ? (
            <EditorEmptyState
              onPickTemplate={onOpenTemplatePicker}
              onRequestUpload={() => htmlFileInputRef.current?.click()}
            />
          ) : null}
          <div
            className={cn(
              'maily-canvas-host flex h-full min-h-0 flex-1 flex-col overflow-hidden',
              '[&_.editor-scrollable-container]:!h-full',
              '[&_.editor-scrollable-container]:!min-h-full',
              '[&_.editor-scrollable-container]:!max-h-none',
              '[&_.editor-scrollable-container]:!overflow-y-auto',
              '[&_.editor-scrollable-container]:!rounded-none',
              '[&_.editor-scrollable-container]:!border-0',
              '[&_.editor-scrollable-container]:!w-full',
              '[&_.editor-scrollable-container]:!pt-0'
            )}
            style={
              {
                '--maily-email-body-width': editorBodyWidth,
              } as CSSProperties
            }
          >
            <Editor
              contentJson={(value as never) ?? undefined}
              blocks={slashGroups}
              extensions={slashExtensions}
              onCreate={(editor: TiptapEditor) => {
                syncEditorEmptyState(editor)
                attachFocusListeners(editor)
                pasteCleanupRef.current?.()
                pasteCleanupRef.current = attachHtmlPasteListener(
                  editor,
                  () => toast.success('HTML colado'),
                  (error) =>
                    toast.error('Falha ao importar HTML colado', {
                      description: error instanceof Error ? error.message : undefined,
                    })
                )
              }}
              onUpdate={(editor: TiptapEditor) => {
                syncEditorEmptyState(editor)
                const json = editor.getJSON()
                const html = editor.getHTML()
                onChange(json, html)
              }}
              config={{
                hasMenuBar: false,
                hideContextMenu: false,
                wrapClassName: 'leadflow-maily-root mx-auto h-full w-full max-w-full',
                bodyClassName: 'leadflow-maily-body !mt-0 !h-full !rounded-none !border-0 !bg-transparent !px-0 !pt-3 !pb-8',
                contentClassName: 'leadflow-maily-content min-h-full pl-9 pr-6 pt-1',
              }}
            />
          </div>
        </div>
      </EmailCanvasFrame>

      <div
        ref={railRef}
        className="absolute left-6 top-1/2 hidden -translate-y-1/2 items-start gap-3 lg:flex"
      >
        <div className="rounded-[28px] border border-[#1c2027] bg-[#111117]/96 p-1 shadow-[0_20px_35px_rgba(0,0,0,0.42)]">
          <div className="flex flex-col gap-1">
            {railGroups.map((group) => (
              <div
                key={group.id}
                className="relative"
                onMouseEnter={() => setHoveredGroupId(group.id)}
                onMouseLeave={() => setHoveredGroupId((current) => (current === group.id ? null : current))}
              >
                <FloatingToolButton
                  active={activeGroupId === group.id}
                  title={group.railLabel}
                  onClick={() => setActiveGroupId((current) => (current === group.id ? null : group.id))}
                >
                  {group.renderIcon(activeGroupId === group.id ? 'h-4 w-4 text-white' : 'h-4 w-4 text-current')}
                </FloatingToolButton>

                {activeGroupId !== group.id && hoveredGroupId === group.id ? (
                  <div className="pointer-events-none absolute left-[calc(100%+10px)] top-1/2 -translate-y-1/2 rounded-md border border-[#2e3440] bg-[#20242d] px-2.5 py-1 text-xs font-medium text-white shadow-[0_12px_24px_rgba(0,0,0,0.28)]">
                    {group.railLabel}
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        </div>

        {activeGroup ? (
          <div className="w-[308px] overflow-hidden rounded-[28px] border border-[#1c2027] bg-[#09090b]/98 shadow-[0_24px_56px_rgba(0,0,0,0.52)] backdrop-blur-xl">
            <div className="flex items-center gap-3 border-b border-[#171b22] px-4 py-3.5">
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-xl border border-[#232833] bg-[#111117] text-white/72">
                {activeGroup.renderIcon('h-4 w-4')}
              </span>
              <div className="flex min-w-0 flex-1 items-center justify-between gap-3">
                <span className="truncate text-[18px] font-semibold text-white">{activeGroup.menuTitle}</span>
                <span className="text-white/28">⋮</span>
              </div>
            </div>

            {activeGroup.id === 'variables' && leadFlowMetadata.variables.length === 0 ? (
              <EmptyVariablesState
                onCreate={() => {
                  const createAction = activeGroup.actions.find((action) => action.modalKind === 'variable')
                  if (!createAction) return
                  handleRailActionClick(createAction)
                }}
              />
            ) : (
              <div className="flex max-h-[420px] flex-col gap-1 overflow-y-auto px-3 py-3">
                {activeGroup.actions.map((action) => (
                  <MenuActionButton
                    key={action.id}
                    icon={action.renderIcon('h-4 w-4')}
                    label={action.id === 'image' && isUploadingImage ? 'Uploading image...' : action.label}
                    description={
                      action.id === 'image' && isUploadingImage ? 'Sending the selected image to storage.' : action.description
                    }
                    onClick={() => handleRailActionClick(action)}
                  />
                ))}
              </div>
            )}

            {activeGroup.id === 'image' && imageUploadError ? (
              <div className="border-t border-[#171b22] px-4 py-3 text-xs text-[#ff8d74]">{imageUploadError}</div>
            ) : null}
          </div>
        ) : null}
      </div>

      <Dialog open={pendingModal?.kind === 'variable'} onOpenChange={(open) => (!open ? closeModal() : undefined)}>
        <DialogContent className="flex max-h-[90vh] max-w-[560px] flex-col gap-0 overflow-hidden rounded-[32px] border-[#1d212b] bg-[#05050a] p-0 text-white">
          <form
            className="flex min-h-0 flex-1 flex-col"
            onSubmit={handleVariableSubmit}
            onKeyDown={(event) => handleModalShortcut(event, handleVariableSubmit)}
          >
            <div className="dialog-scrollbar-visible flex-1 overflow-y-auto px-6 py-6">
              <DialogHeader className="text-left">
                <DialogTitle className="text-[28px] font-semibold text-white">Create variable</DialogTitle>
                <DialogDescription className="text-white/42">
                  Save a reusable token and insert it at the current cursor.
                </DialogDescription>
              </DialogHeader>

              <div className="mt-6 flex flex-col gap-5">
                <div className="flex flex-col gap-2">
                  <Label htmlFor="variable-name" className="text-sm font-medium text-white/78">
                    Name
                  </Label>
                  <Input
                    id="variable-name"
                    value={variableDraft.name}
                    onChange={(event) => setVariableDraft((current) => ({ ...current, name: event.target.value }))}
                    placeholder="{{{ YOUR_VARIABLE }}}"
                    className="h-12 rounded-2xl border-white/10 bg-white/6 text-base text-white placeholder:text-white/26"
                  />
                </div>

                <div className="flex flex-col gap-2">
                  <Label htmlFor="variable-type" className="text-sm font-medium text-white/78">
                    Type
                  </Label>
                  <Select
                    value={variableDraft.type}
                    onValueChange={(nextValue) =>
                      setVariableDraft((current) => ({
                        ...current,
                        type: nextValue as LeadFlowVariableType,
                      }))
                    }
                  >
                    <SelectTrigger
                      id="variable-type"
                      className="h-12 rounded-2xl border-white/10 bg-white/6 text-base text-white"
                    >
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="border-white/10 bg-[#111117] text-white">
                      <SelectGroup>
                        <SelectItem value="string">String</SelectItem>
                        <SelectItem value="number">Number</SelectItem>
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex flex-col gap-2">
                  <Label htmlFor="variable-fallback" className="text-sm font-medium text-white/78">
                    Fallback value
                  </Label>
                  <Input
                    id="variable-fallback"
                    value={variableDraft.fallbackValue}
                    onChange={(event) =>
                      setVariableDraft((current) => ({ ...current, fallbackValue: event.target.value }))
                    }
                    placeholder="Value that appears if the variable is empty"
                    className="h-12 rounded-2xl border-white/10 bg-white/6 text-base text-white placeholder:text-white/26"
                  />
                </div>

                {normalizeVariableKey(variableDraft.name).length > 0 ? (
                  <div className="rounded-[20px] border border-white/10 bg-white/[0.03] px-4 py-3">
                    <p className="text-xs uppercase tracking-[0.16em] text-white/32">Token</p>
                    <p className="mt-2 text-sm font-medium text-white">
                      {buildVariableToken(
                        normalizeVariableKey(variableDraft.name),
                        variableDraft.fallbackValue.trim() || undefined
                      )}
                    </p>
                  </div>
                ) : null}
              </div>
            </div>

            <DialogFooter className="border-t border-white/8 px-6 py-4 sm:justify-start">
              <div className="flex flex-wrap items-center gap-3">
                <Button
                  type="submit"
                  disabled={normalizeVariableKey(variableDraft.name).length === 0}
                  className="rounded-full bg-white px-4 text-black hover:bg-white/90"
                >
                  <span>Create</span>
                  <ShortcutHint>Ctrl ↵</ShortcutHint>
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={closeModal}
                  className="rounded-full border-white/10 bg-white/6 text-white hover:bg-white/10 hover:text-white"
                >
                  <span>Cancel</span>
                  <ShortcutHint>Esc</ShortcutHint>
                </Button>
              </div>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={pendingModal?.kind === 'youtube'} onOpenChange={(open) => (!open ? closeModal() : undefined)}>
        <DialogContent className="flex max-h-[90vh] max-w-[620px] flex-col gap-0 overflow-hidden rounded-[32px] border-[#1d212b] bg-[#05050a] p-0 text-white">
          <form
            className="flex min-h-0 flex-1 flex-col"
            onSubmit={handleYoutubeSubmit}
            onKeyDown={(event) => handleModalShortcut(event, handleYoutubeSubmit)}
          >
            <div className="dialog-scrollbar-visible flex-1 overflow-y-auto px-6 py-6">
              <DialogHeader className="text-left">
                <DialogTitle className="text-[28px] font-semibold text-white">Add YouTube video</DialogTitle>
                <DialogDescription className="text-white/42">
                  Insert an email-safe video card with a live thumbnail preview.
                </DialogDescription>
              </DialogHeader>

              <div className="mt-6 flex flex-col gap-5">
                <div className="flex flex-col gap-2">
                  <Label htmlFor="youtube-url" className="text-sm font-medium text-white/78">
                    YouTube URL
                  </Label>
                  <Input
                    id="youtube-url"
                    value={youtubeDraft.url}
                    onChange={(event) => setYoutubeDraft((current) => ({ ...current, url: event.target.value }))}
                    placeholder="https://www.youtube.com/watch?v=..."
                    className={cn(
                      'h-12 rounded-2xl bg-white/6 text-base text-white placeholder:text-white/26',
                      youtubeUrlError
                        ? 'border-[#f97316] focus-visible:ring-1 focus-visible:ring-[#f97316]'
                        : 'border-white/10'
                    )}
                  />
                  {youtubeUrlError ? <p className="text-xs text-[#ff8d74]">{youtubeUrlError}</p> : null}
                </div>

                <div className="flex flex-col gap-3">
                  <Label className="text-sm font-medium text-white/78">Customize</Label>
                  <label className="flex items-center gap-3 py-1 text-sm text-white/78">
                    <Checkbox
                      checked={youtubeDraft.includePlayButton}
                      onCheckedChange={(checked) =>
                        setYoutubeDraft((current) => ({ ...current, includePlayButton: Boolean(checked) }))
                      }
                    />
                    <span>Include play button</span>
                  </label>
                </div>

                <div className="flex flex-col gap-3">
                  <Label className="text-sm font-medium text-white/78">Preview</Label>
                  {youtubeThumbnailUrl ? (
                    <ImagePreviewSurface
                      src={youtubeThumbnailUrl}
                      alt="YouTube thumbnail preview"
                      showPlayButton={youtubeDraft.includePlayButton}
                    />
                  ) : (
                    <div className="rounded-[18px] border border-dashed border-white/10 bg-white/[0.03] px-4 py-10 text-center text-sm text-white/40">
                      Enter a valid YouTube URL to preview the thumbnail.
                    </div>
                  )}
                </div>
              </div>
            </div>

            <DialogFooter className="border-t border-white/8 px-6 py-4 sm:justify-start">
              <div className="flex flex-wrap items-center gap-3">
                <Button
                  type="submit"
                  disabled={!youtubeVideoId || !youtubeThumbnailUrl || Boolean(youtubeUrlError)}
                  className="rounded-full bg-white px-4 text-black hover:bg-white/90"
                >
                  <span>Save</span>
                  <ShortcutHint>Ctrl ↵</ShortcutHint>
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={closeModal}
                  className="rounded-full border-white/10 bg-white/6 text-white hover:bg-white/10 hover:text-white"
                >
                  <span>Cancel</span>
                  <ShortcutHint>Esc</ShortcutHint>
                </Button>
              </div>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={pendingModal?.kind === 'twitter'} onOpenChange={(open) => (!open ? closeModal() : undefined)}>
        <DialogContent className="flex max-h-[90vh] max-w-[620px] flex-col gap-0 overflow-hidden rounded-[32px] border-[#1d212b] bg-[#05050a] p-0 text-white">
          <form
            className="flex min-h-0 flex-1 flex-col"
            onSubmit={handleTwitterSubmit}
            onKeyDown={(event) => handleModalShortcut(event, handleTwitterSubmit)}
          >
            <div className="dialog-scrollbar-visible flex-1 overflow-y-auto px-6 py-6">
              <DialogHeader className="text-left">
                <DialogTitle className="text-[28px] font-semibold text-white">Embed X (former Twitter) post</DialogTitle>
                <DialogDescription className="text-white/42">
                  Preview the official X embed and save an email-safe card for the canvas.
                </DialogDescription>
              </DialogHeader>

              <div className="mt-6 flex flex-col gap-5">
                <div className="flex flex-col gap-2">
                  <Label htmlFor="x-url" className="text-sm font-medium text-white/78">
                    URL
                  </Label>
                  <Input
                    id="x-url"
                    value={twitterDraft.url}
                    onChange={(event) => setTwitterDraft((current) => ({ ...current, url: event.target.value }))}
                    placeholder="https://twitter.com/user/status/..."
                    className={cn(
                      'h-12 rounded-2xl bg-white/6 text-base text-white placeholder:text-white/26',
                      xUrlError ? 'border-[#f97316] focus-visible:ring-1 focus-visible:ring-[#f97316]' : 'border-white/10'
                    )}
                  />
                  {xUrlError ? <p className="text-xs text-[#ff8d74]">{xUrlError}</p> : null}
                </div>

                <div className="flex flex-col gap-3">
                  <Label className="text-sm font-medium text-white/78">Theme</Label>
                  <label className="flex items-center gap-3 py-1 text-sm text-white/78">
                    <Checkbox
                      checked={twitterDraft.darkMode}
                      onCheckedChange={(checked) =>
                        setTwitterDraft((current) => ({ ...current, darkMode: Boolean(checked) }))
                      }
                    />
                    <span>Dark mode</span>
                  </label>
                </div>

                <div className="flex flex-col gap-3">
                  <Label className="text-sm font-medium text-white/78">Preview</Label>
                  {twitterGeneratedAsset ? (
                    <HtmlEmbedPreviewSurface
                      html={twitterGeneratedAsset.html}
                      title={`X preview for @${twitterGeneratedAsset.handle}`}
                    />
                  ) : isGeneratingXAsset ? (
                    <div className="rounded-[18px] border border-white/10 bg-white/[0.03] px-4 py-10 text-center text-sm text-white/52">
                      Loading official X embed preview...
                    </div>
                  ) : twitterAssetError ? (
                    <div className="rounded-[18px] border border-[#2d1c1a] bg-[#1a0f0d] px-4 py-5 text-sm text-[#ffb4a6]">
                      {twitterAssetError}
                    </div>
                  ) : (
                    <div className="rounded-[18px] border border-dashed border-white/10 bg-white/[0.03] px-4 py-10 text-center text-sm text-white/40">
                      Enter a valid X or Twitter post URL to preview the official embed.
                    </div>
                  )}
                </div>
              </div>
            </div>

            <DialogFooter className="border-t border-white/8 px-6 py-4 sm:justify-start">
              <div className="flex flex-wrap items-center gap-3">
                <Button
                  type="submit"
                  disabled={!parsedXPost || Boolean(xUrlError) || isGeneratingXAsset || !twitterGeneratedAsset}
                  className="rounded-full bg-white px-4 text-black hover:bg-white/90"
                >
                  <span>Save</span>
                  <ShortcutHint>Ctrl ↵</ShortcutHint>
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={closeModal}
                  className="rounded-full border-white/10 bg-white/6 text-white hover:bg-white/10 hover:text-white"
                >
                  <span>Cancel</span>
                  <ShortcutHint>Esc</ShortcutHint>
                </Button>
              </div>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <style jsx global>{`
        .maily-canvas-host > #mly-editor.leadflow-maily-root {
          height: 100%;
          width: 100%;
          max-width: 100%;
        }

        .maily-canvas-host > #mly-editor.leadflow-maily-root > .leadflow-maily-body {
          min-height: 100%;
          height: 100%;
          width: min(100%, var(--maily-email-body-width));
          max-width: var(--maily-email-body-width);
          margin-inline: auto;
        }

        .maily-canvas-host > #mly-editor.leadflow-maily-root .ProseMirror p.is-editor-empty:first-child::before,
        .maily-canvas-host > #mly-editor.leadflow-maily-root .ProseMirror p.is-empty:first-child::before {
          content: none !important;
        }

        .maily-canvas-host > #mly-editor.leadflow-maily-root .ProseMirror {
          min-height: 100%;
          padding-bottom: 48px;
        }

        .maily-canvas-host > #mly-editor.leadflow-maily-root .ProseMirror > * {
          scroll-margin-top: 32px;
        }

        .maily-canvas-host [data-tippy-root] .mly\\:flex.mly\\:items-center.mly\\:pr-1\\.5 {
          gap: 6px;
          padding-right: 0;
        }

        .maily-canvas-host [data-tippy-root] .mly\\:cursor-grab {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 28px !important;
          height: 28px !important;
          border: 1px solid rgba(221, 221, 227, 0.92);
          border-radius: 10px;
          background: rgba(255, 255, 255, 0.98);
          box-shadow: 0 10px 25px rgba(17, 24, 39, 0.14);
          color: #71717a;
        }

        .maily-canvas-host [data-tippy-root] .mly\\:cursor-grab:hover {
          background: #ffffff;
          color: #111827;
        }

        .maily-canvas-host [data-tippy-root] .mly\\:cursor-grab svg {
          width: 15px;
          height: 15px;
        }

        .maily-canvas-host [data-tippy-root] .mly\\:flex.mly\\:items-center.mly\\:pr-1\\.5 > .mly\\:relative.mly\\:flex.mly\\:flex-col {
          display: inline-flex;
          flex-direction: column;
        }

        .tippy-box[data-theme~='maily-slash'] {
          border: 1px solid rgba(39, 39, 42, 0.92);
          border-radius: 14px;
          background: #09090b;
          box-shadow: 0 24px 40px rgba(0, 0, 0, 0.38);
          color: #f4f4f5;
        }

        .tippy-box[data-theme~='maily-slash'] .tippy-content {
          padding: 0;
        }

        .maily-slash-menu {
          width: min(320px, calc(100vw - 32px));
          overflow: hidden;
          border-radius: 14px;
          background: #09090b;
        }

        .maily-slash-menu__scroll {
          max-height: 332px;
          overflow-y: auto;
          padding: 8px;
        }

        .maily-slash-menu__group + .maily-slash-menu__group {
          margin-top: 10px;
        }

        .maily-slash-menu__label {
          padding: 0 8px 8px;
          font-size: 11px;
          font-weight: 600;
          letter-spacing: 0.04em;
          color: #a1a1aa;
          text-transform: uppercase;
        }

        .maily-slash-menu__items {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .maily-slash-menu__item {
          display: flex;
          width: 100%;
          align-items: center;
          gap: 10px;
          border: 0;
          border-radius: 10px;
          background: transparent;
          padding: 10px 12px;
          text-align: left;
          color: #fafafa;
          transition: background-color 160ms ease, color 160ms ease;
        }

        .maily-slash-menu__item[data-selected='true'] {
          background: #18181b;
        }

        .maily-slash-menu__item:hover {
          background: #18181b;
        }

        .maily-slash-menu__icon {
          display: inline-flex;
          min-width: 18px;
          align-items: center;
          justify-content: center;
          color: #d4d4d8;
        }

        .maily-slash-menu__title {
          font-size: 15px;
          line-height: 1.15;
          color: inherit;
        }

        .maily-slash-menu__footer {
          display: flex;
          align-items: center;
          gap: 10px;
          border-top: 1px solid rgba(39, 39, 42, 0.9);
          padding: 11px 14px 12px;
          color: #a1a1aa;
        }

        .maily-slash-menu__footer-text {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          font-size: 11px;
          line-height: 1;
        }

        .maily-slash-menu__kbd {
          display: inline-flex;
          min-width: 24px;
          align-items: center;
          justify-content: center;
          border: 1px solid rgba(63, 63, 70, 0.96);
          border-radius: 6px;
          background: #111114;
          padding: 4px 6px;
          font-size: 10px;
          font-weight: 600;
          color: #e4e4e7;
        }

        .maily-slash-menu__dot {
          color: #52525b;
        }

        .maily-canvas-host [data-tippy-root] .tippy-content > [class*='mly:bg-white'][class*='mly:rounded'] {
          border: 1px solid rgba(39, 39, 42, 0.92);
          background: #09090b;
          color: #f4f4f5;
          box-shadow: 0 18px 32px rgba(0, 0, 0, 0.34);
        }

        .maily-canvas-host [data-tippy-root] .tippy-content > [class*='mly:bg-white'][class*='mly:rounded'] [class*='mly:border-gray-200'],
        .maily-canvas-host [data-tippy-root] .tippy-content > [class*='mly:bg-white'][class*='mly:rounded'] [class*='mly:border-gray-300'],
        .maily-canvas-host [data-radix-popper-content-wrapper] > .mly-editor [class*='mly:border-gray-200'],
        .maily-canvas-host [data-radix-popper-content-wrapper] > .mly-editor [class*='mly:border-gray-300'] {
          border-color: rgba(63, 63, 70, 0.96) !important;
        }

        .maily-canvas-host [data-tippy-root] .tippy-content > [class*='mly:bg-white'][class*='mly:rounded'] button.mly-editor,
        .maily-canvas-host [data-radix-popper-content-wrapper] > .mly-editor button.mly-editor,
        .maily-canvas-host [data-radix-popper-content-wrapper] > .mly-editor button {
          color: rgba(244, 244, 245, 0.78);
        }

        .maily-canvas-host [data-tippy-root] .tippy-content > [class*='mly:bg-white'][class*='mly:rounded'] button.mly-editor:hover,
        .maily-canvas-host [data-tippy-root] .tippy-content > [class*='mly:bg-white'][class*='mly:rounded'] button.mly-editor[data-state='true'],
        .maily-canvas-host [data-radix-popper-content-wrapper] > .mly-editor button.mly-editor:hover,
        .maily-canvas-host [data-radix-popper-content-wrapper] > .mly-editor button.mly-editor[data-state='true'] {
          background: #18181b;
          color: #ffffff;
        }

        .maily-canvas-host [data-tippy-root] .tippy-content > [class*='mly:bg-red-100'],
        .maily-canvas-host [data-radix-popper-content-wrapper] > .mly-editor [class*='mly:bg-red-100'] {
          background: rgba(127, 29, 29, 0.22) !important;
          color: #fda4af !important;
        }

        .maily-canvas-host [data-tippy-root] .tippy-content > [class*='mly:bg-red-100']:hover,
        .maily-canvas-host [data-radix-popper-content-wrapper] > .mly-editor [class*='mly:bg-red-100']:hover {
          background: rgba(127, 29, 29, 0.36) !important;
          color: #ffe4e6 !important;
        }

        .maily-canvas-host [data-radix-popper-content-wrapper] > .mly-editor {
          border-color: rgba(39, 39, 42, 0.92) !important;
          background: #09090b !important;
          color: #f4f4f5 !important;
          box-shadow: 0 18px 32px rgba(0, 0, 0, 0.34) !important;
        }

        .maily-canvas-host [data-radix-popper-content-wrapper] > .mly-editor input.mly-editor,
        .maily-canvas-host [data-radix-popper-content-wrapper] > .mly-editor textarea.mly-editor,
        .maily-canvas-host [data-radix-popper-content-wrapper] > .mly-editor [class*='mly:h-8'][class*='mly:bg-white'][class*='mly:border'] {
          border-color: rgba(63, 63, 70, 0.96) !important;
          background: #111114 !important;
          color: #fafafa !important;
          box-shadow: none !important;
        }

        .maily-canvas-host [data-radix-popper-content-wrapper] > .mly-editor input.mly-editor::placeholder,
        .maily-canvas-host [data-radix-popper-content-wrapper] > .mly-editor textarea.mly-editor::placeholder {
          color: rgba(161, 161, 170, 0.9) !important;
        }

        .maily-canvas-host [data-tippy-root] .tippy-content > [class*='mly:bg-white'][class*='mly:rounded'] [class*='mly:text-gray-500'],
        .maily-canvas-host [data-tippy-root] .tippy-content > [class*='mly:bg-white'][class*='mly:rounded'] [class*='mly:text-slate-400'],
        .maily-canvas-host [data-tippy-root] .tippy-content > [class*='mly:bg-white'][class*='mly:rounded'] [class*='mly:text-midnight-gray'],
        .maily-canvas-host [data-radix-popper-content-wrapper] > .mly-editor [class*='mly:text-gray-500'],
        .maily-canvas-host [data-radix-popper-content-wrapper] > .mly-editor [class*='mly:text-slate-400'],
        .maily-canvas-host [data-radix-popper-content-wrapper] > .mly-editor [class*='mly:text-midnight-gray'] {
          color: #a1a1aa !important;
        }

        .maily-canvas-host [data-tippy-root] .tippy-content > [class*='mly:bg-white'][class*='mly:rounded'] [class*='mly:text-gray-950'],
        .maily-canvas-host [data-radix-popper-content-wrapper] > .mly-editor [class*='mly:text-gray-950'] {
          color: #f4f4f5 !important;
        }
      `}</style>
    </div>
  )
}
