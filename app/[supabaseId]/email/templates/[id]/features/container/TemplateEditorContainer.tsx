'use client'

import type { ReactNode } from 'react'
import { useEffect, useRef, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import {
  Code2,
  Copy,
  FileText,
  House,
  Loader2,
  Mail,
  MoreHorizontal,
  Pencil,
  SlidersHorizontal,
  Trash2,
  Users,
} from 'lucide-react'
import { toast } from 'sonner'
import { useUserContext } from '@/app/context/UserContext'
import { MonacoCodeEditor } from '@/components/editors/MonacoCodeEditor'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Sheet, SheetContent } from '@/components/ui/sheet'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useTemplateEditorContext } from '../context/TemplateEditorContext'
import { MailyEditor } from '../components/MailyEditor'
import { HtmlEditor } from '../components/HtmlEditor'
import { FloatingInspector } from '../components/FloatingInspector'
import { EditorMode } from '../context/TemplateEditorTypes'
import {
  derivePageStyleFromMailyJson,
  getLeadFlowMetadata,
  patchPageStyleInMailyJson,
  setLeadFlowGlobalCss,
  setLeadFlowTheme,
} from '../utils/emailPageStyle'

type TransitionDirection = 'enter-html' | 'return-to-canvas' | 'none'

const chromePassiveButtonClass =
  'border-[#232833] bg-[#111117] text-white/62 hover:border-[#313847] hover:bg-[#171a21] hover:text-white/82'

const chromeActiveButtonClass =
  'border-[#394252] bg-[#171a21] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.04),0_10px_24px_rgba(0,0,0,0.34)]'

function IconSidebarButton({
  active,
  title,
  onClick,
  children,
}: {
  active: boolean
  title: string
  onClick: () => void
  children: ReactNode
}) {
  return (
    <Button
      type="button"
      variant={active ? 'secondary' : 'ghost'}
      size="icon"
      title={title}
      onClick={onClick}
      className={`flex h-8 w-8 items-center justify-center rounded-md border transition-colors ${
        active ? chromeActiveButtonClass : `text-white/42 ${chromePassiveButtonClass}`
      }`}
    >
      {children}
    </Button>
  )
}

function parseThemeJson(raw: string) {
  if (raw.trim().length === 0) {
    return {}
  }

  const parsed = JSON.parse(raw) as unknown
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('Theme must be a JSON object')
  }

  return parsed as Record<string, unknown>
}

function getUserInitials(fullName: string | null | undefined, email: string | null | undefined) {
  const source = fullName?.trim() || email?.trim() || 'Corretor Studio'
  const parts = source.split(/\s+/).filter(Boolean)

  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase()
  }

  return parts
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase()
}

export function TemplateEditorContainer() {
  const router = useRouter()
  const params = useParams()
  const supabaseId = params.supabaseId as string
  const templateId = params.id as string
  const isNew = templateId === 'new'
  const { user } = useUserContext()

  const {
    mode,
    name,
    subject,
    previewText,
    mailyJson,
    html,
    loading,
    saving,
    setMode,
    setName,
    setSubject,
    setPreviewText,
    setMailyJson,
    setHtml,
    handleSave,
  } = useTemplateEditorContext()

  const pageStyle = derivePageStyleFromMailyJson(mailyJson)
  const leadFlowMetadata = getLeadFlowMetadata(mailyJson)
  const derivedThemeValue = JSON.stringify(leadFlowMetadata.theme, null, 2)
  const derivedGlobalCssValue = leadFlowMetadata.globalCss

  const [transitionDirection, setTransitionDirection] = useState<TransitionDirection>('none')
  const previousModeRef = useRef<EditorMode | null>(null)

  const [testEmailOpen, setTestEmailOpen] = useState(false)
  const [testEmailAddress, setTestEmailAddress] = useState('')
  const [sendingTest, setSendingTest] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [duplicating, setDuplicating] = useState(false)
  const [isInspectorPinned, setIsInspectorPinned] = useState(true)
  const [isInspectorHoverOpen, setIsInspectorHoverOpen] = useState(false)
  const [isMobilePanelOpen, setIsMobilePanelOpen] = useState(false)
  const [isActionsMenuOpen, setIsActionsMenuOpen] = useState(false)
  const [isThemeDialogOpen, setIsThemeDialogOpen] = useState(false)
  const [isGlobalCssDialogOpen, setIsGlobalCssDialogOpen] = useState(false)
  const [themeEditorValue, setThemeEditorValue] = useState('{}')
  const [themeEditorError, setThemeEditorError] = useState<string | null>(null)
  const [globalCssValue, setGlobalCssValue] = useState('')
  const inspectorCloseTimeoutRef = useRef<number | null>(null)
  const userInitials = getUserInitials(user?.fullName, user?.email)

  useEffect(() => {
    const persistedPinned = localStorage.getItem('template-editor-inspector-pinned')
    if (persistedPinned !== null) {
      setIsInspectorPinned(persistedPinned === 'true')
      return
    }

    const legacyExpanded = localStorage.getItem('template-editor-inspector-expanded')
    if (legacyExpanded === 'false') {
      setIsInspectorPinned(false)
    }
  }, [])

  useEffect(() => {
    localStorage.setItem('template-editor-inspector-pinned', String(isInspectorPinned))
  }, [isInspectorPinned])

  useEffect(() => {
    if (!isThemeDialogOpen) {
      setThemeEditorValue(derivedThemeValue)
      setThemeEditorError(null)
    }
  }, [derivedThemeValue, isThemeDialogOpen])

  useEffect(() => {
    if (!isGlobalCssDialogOpen) {
      setGlobalCssValue(derivedGlobalCssValue)
    }
  }, [derivedGlobalCssValue, isGlobalCssDialogOpen])

  useEffect(() => {
    if (mode !== 'maily') {
      setIsMobilePanelOpen(false)
      setIsInspectorHoverOpen(false)
    }
  }, [mode])

  useEffect(() => {
    return () => {
      if (inspectorCloseTimeoutRef.current !== null) {
        window.clearTimeout(inspectorCloseTimeoutRef.current)
      }
    }
  }, [])

  useEffect(() => {
    if (!previousModeRef.current) {
      previousModeRef.current = mode
    }
  }, [mode])

  const clearInspectorCloseTimeout = () => {
    if (inspectorCloseTimeoutRef.current !== null) {
      window.clearTimeout(inspectorCloseTimeoutRef.current)
      inspectorCloseTimeoutRef.current = null
    }
  }

  const handleInspectorPointerEnter = () => {
    clearInspectorCloseTimeout()
    if (!isInspectorPinned) {
      setIsInspectorHoverOpen(true)
    }
  }

  const handleInspectorPointerLeave = () => {
    if (isInspectorPinned) return

    clearInspectorCloseTimeout()
    inspectorCloseTimeoutRef.current = window.setTimeout(() => {
      setIsInspectorHoverOpen(false)
      inspectorCloseTimeoutRef.current = null
    }, 140)
  }

  const handleInspectorPinToggle = () => {
    clearInspectorCloseTimeout()

    setIsInspectorPinned((previous) => {
      if (previous) {
        setIsInspectorHoverOpen(true)
      } else {
        setIsInspectorHoverOpen(false)
      }

      return !previous
    })
  }

  const handlePageStyleChange = (patch: Partial<typeof pageStyle>) => {
    const nextJson = patchPageStyleInMailyJson(mailyJson, patch)
    setMailyJson(nextJson)
  }

  const handleOpenThemeDialog = () => {
    setThemeEditorValue(derivedThemeValue)
    setThemeEditorError(null)
    setIsThemeDialogOpen(true)
  }

  const handleOpenGlobalCssDialog = () => {
    setGlobalCssValue(derivedGlobalCssValue)
    setIsGlobalCssDialogOpen(true)
  }

  const handleThemeChange = (next: string) => {
    setThemeEditorValue(next)

    try {
      const parsedTheme = parseThemeJson(next)
      setMailyJson(setLeadFlowTheme(mailyJson, parsedTheme))
      setThemeEditorError(null)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Invalid JSON'
      setThemeEditorError(message)
    }
  }

  const handleGlobalCssChange = (next: string) => {
    setGlobalCssValue(next)
    setMailyJson(setLeadFlowGlobalCss(mailyJson, next))
  }

  const handleBack = () => {
    router.push(`/${supabaseId}/email/templates`)
  }

  const handleSwitchMode = (nextMode: EditorMode) => {
    if (nextMode === mode) return

    if (mode === 'maily' && nextMode === 'html') {
      setTransitionDirection('enter-html')
    } else if (mode === 'html' && nextMode === 'maily') {
      setTransitionDirection('return-to-canvas')
    } else {
      setTransitionDirection('none')
    }

    previousModeRef.current = nextMode
    setMode(nextMode)
  }

  const handleMailyChange = (json: unknown, generatedHtml: string) => {
    setMailyJson(json)
    setHtml(generatedHtml)
  }

  const handleSendTest = async () => {
    if (!testEmailAddress.trim()) return
    if (isNew) {
      toast.error('Salve o template antes de enviar um teste')
      return
    }

    setSendingTest(true)
    try {
      const response = await fetch(`/api/v1/email/templates/${templateId}/test`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to: testEmailAddress.trim() }),
      })

      if (!response.ok) {
        const data = await response.json().catch(() => ({}))
        throw new Error(data.error ?? 'Erro ao enviar email de teste')
      }

      toast.success('Email de teste enviado', { description: testEmailAddress.trim() })
      setTestEmailOpen(false)
      setTestEmailAddress('')
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Erro ao enviar email de teste'
      console.error('[TemplateEditorContainer] sendTest error', error)
      toast.error('Erro ao enviar email de teste', { description: message })
    } finally {
      setSendingTest(false)
    }
  }

  const handleDuplicate = async () => {
    if (isNew) {
      toast.error('Salve o template antes de duplicar')
      return
    }

    setDuplicating(true)
    try {
      const response = await fetch('/api/v1/email/templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: `${name} (cópia)`,
          subject,
          previewText: previewText || undefined,
          mailyJson: mailyJson ?? undefined,
          html: html || undefined,
        }),
      })

      if (!response.ok) {
        throw new Error('Erro ao duplicar template')
      }

      const data = await response.json()
      toast.success('Template duplicado')
      router.push(`/${supabaseId}/email/templates/${data.result.id}`)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Erro ao duplicar template'
      console.error('[TemplateEditorContainer] duplicate error', error)
      toast.error('Erro ao duplicar template', { description: message })
    } finally {
      setDuplicating(false)
    }
  }

  const handleShareWithTeam = () => {
    toast.success('Template compartilhado com o time', {
      description: 'Todos os membros do time podem usar este template em campanhas.',
    })
  }

  const handleDelete = async () => {
    if (isNew) return

    setDeleting(true)
    try {
      const response = await fetch(`/api/v1/email/templates/${templateId}`, { method: 'DELETE' })
      if (!response.ok) {
        throw new Error('Erro ao excluir template')
      }

      toast.success('Template excluído')
      router.push(`/${supabaseId}/email/templates`)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Erro ao excluir template'
      console.error('[TemplateEditorContainer] delete error', error)
      toast.error('Erro ao excluir template', { description: message })
    } finally {
      setDeleting(false)
      setDeleteOpen(false)
    }
  }

  if (loading) {
    return (
      <div className="flex h-full min-h-0 bg-[#05050A]">
        <div className="w-12 shrink-0 bg-[#05050A]" />
        <div className="flex min-w-0 flex-1 flex-col">
          <div className="flex h-12 items-center gap-2 bg-[#05050A] px-4">
            <Skeleton className="h-4 w-48 bg-white/10" />
          </div>
          <div className="flex min-h-0 flex-1 items-center justify-center bg-[#0b0b0f]">
            <Skeleton className="h-[640px] w-[600px] rounded-[20px] bg-white/5" />
          </div>
        </div>
      </div>
    )
  }

  return (
    <>
      <div className="flex h-full min-h-0 bg-[#05050A] text-white">
        <div className="flex w-12 shrink-0 flex-col items-center gap-1 bg-[#05050A] pt-3">
          <div className="mb-2 flex h-8 w-8 items-center justify-center rounded-md border border-transparent bg-transparent text-white/45 transition-colors hover:border-[#232833] hover:bg-[#111117] hover:text-white/78">
            <House className="h-4 w-4" />
          </div>
          <IconSidebarButton
            active={mode === 'maily'}
            title="Editor visual"
            onClick={() => handleSwitchMode('maily' as EditorMode)}
          >
            <Pencil className="h-4 w-4" />
          </IconSidebarButton>
          <IconSidebarButton
            active={mode === 'html'}
            title="Editor HTML"
            onClick={() => handleSwitchMode('html' as EditorMode)}
          >
            <Code2 className="h-4 w-4" />
          </IconSidebarButton>
        </div>

        <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
          <div className="flex h-12 shrink-0 items-center gap-1.5 bg-[#05050A] px-4">
            <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-[#20242d] bg-[#0f1015] text-white/60">
              <FileText className="h-3.5 w-3.5" />
            </span>
            <Button
              type="button"
              variant="ghost"
              onClick={handleBack}
              className="h-8 whitespace-nowrap px-0 text-sm text-white/52 transition-colors hover:bg-transparent hover:text-white/82"
            >
              Templates
            </Button>
            <span className="text-sm text-white/28">/</span>
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Untitled Template"
              className="min-w-0 flex-1 bg-transparent text-sm font-semibold text-white/90 outline-none placeholder:text-white/40"
            />
            <Badge
              variant="secondary"
              className="rounded-full border border-[#232833] bg-[#111117] px-2 py-0.5 text-[11px] font-medium text-white/58"
            >
              Draft
            </Badge>

            <div className="ml-2 flex shrink-0 items-center gap-1.5">
              {mode === 'maily' ? (
                <Button
                  type="button"
                  variant={isMobilePanelOpen ? 'secondary' : 'ghost'}
                  onClick={() => setIsMobilePanelOpen(true)}
                  className={`inline-flex h-7 w-7 items-center justify-center rounded-md border xl:hidden ${
                    isMobilePanelOpen ? chromeActiveButtonClass : `${chromePassiveButtonClass} text-white/62`
                  }`}
                  title="Page style"
                >
                  <SlidersHorizontal className="h-3.5 w-3.5" />
                </Button>
              ) : null}

              <DropdownMenu open={isActionsMenuOpen} onOpenChange={setIsActionsMenuOpen}>
                <DropdownMenuTrigger asChild>
                  <Button
                    type="button"
                    variant={isActionsMenuOpen ? 'secondary' : 'ghost'}
                    disabled={duplicating || deleting}
                    className={`flex h-7 w-7 items-center justify-center rounded-md border disabled:opacity-40 ${
                      isActionsMenuOpen ? chromeActiveButtonClass : `${chromePassiveButtonClass} text-white/56`
                    }`}
                  >
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-52">
                  <DropdownMenuItem onClick={() => setTestEmailOpen(true)} disabled={isNew}>
                    <Mail className="mr-2 h-4 w-4" />
                    Enviar email de teste
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={handleDuplicate} disabled={isNew || duplicating}>
                    <Copy className="mr-2 h-4 w-4" />
                    {duplicating ? 'Duplicando...' : 'Duplicar'}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={handleShareWithTeam}>
                    <Users className="mr-2 h-4 w-4" />
                    Compartilhar com o time
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    className="text-destructive focus:text-destructive"
                    onClick={() => setDeleteOpen(true)}
                    disabled={isNew}
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    Excluir
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

              <Avatar className="size-8 border border-[#232833] bg-[#111117]">
                <AvatarImage src={user?.profileIconUrl ?? undefined} alt={user?.fullName ?? user?.email ?? 'Usuário'} />
                <AvatarFallback className="bg-[#dff5ef] text-[11px] font-semibold text-[#17362b]">
                  {userInitials}
                </AvatarFallback>
              </Avatar>

              <Button
                variant="ghost"
                size="sm"
                onClick={handleSave}
                disabled={saving}
                className="h-8 rounded-full border border-[#d8d8de] bg-white px-3.5 text-xs font-semibold text-black shadow-[0_1px_0_rgba(255,255,255,0.35)] hover:bg-white/92"
              >
                {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Publicar'}
              </Button>
            </div>
          </div>

          <div className="relative flex min-h-0 flex-1 overflow-hidden bg-[#0b0b0f]">
            <div className="flex min-w-0 flex-1 flex-col overflow-hidden bg-[#0b0b0f]">
              {mode === 'maily' ? (
                <MailyEditor
                  value={mailyJson}
                  subject={subject}
                  previewText={previewText}
                  pageStyle={pageStyle}
                  transitionDirection={transitionDirection}
                  onChangeSubject={setSubject}
                  onChangePreviewText={setPreviewText}
                  onChange={handleMailyChange}
                />
              ) : (
                <HtmlEditor
                  value={html}
                  subject={subject}
                  previewText={previewText}
                  pageStyle={pageStyle}
                  globalCss={leadFlowMetadata.globalCss}
                  transitionDirection={transitionDirection}
                  onChangeSubject={setSubject}
                  onChangePreviewText={setPreviewText}
                  onChange={setHtml}
                />
              )}
            </div>

            {mode === 'maily' ? (
              <div
                className={`absolute right-10 z-30 hidden justify-end transition-[width,height,transform] duration-200 ease-out xl:flex ${
                  isInspectorPinned || isInspectorHoverOpen
                    ? 'inset-y-4 w-[318px] items-stretch'
                    : 'top-1/2 h-28 w-12 -translate-y-1/2 items-center'
                }`}
                onPointerEnter={handleInspectorPointerEnter}
                onPointerLeave={handleInspectorPointerLeave}
              >
                <FloatingInspector
                  open={isInspectorPinned || isInspectorHoverOpen}
                  pinned={isInspectorPinned}
                  pageStyle={pageStyle}
                  onPinToggle={handleInspectorPinToggle}
                  onPageStyleChange={handlePageStyleChange}
                  onOpenTheme={handleOpenThemeDialog}
                  onOpenGlobalCss={handleOpenGlobalCssDialog}
                  className="h-full w-full rounded-[26px]"
                />
              </div>
            ) : null}
          </div>
        </div>
      </div>

      <Sheet open={isMobilePanelOpen} onOpenChange={setIsMobilePanelOpen}>
        <SheetContent
          side="right"
          className="w-[92vw] max-w-[360px] border-white/10 bg-[#05050A] p-0 text-white"
        >
          <FloatingInspector
            open
            pinned
            pageStyle={pageStyle}
            onPinToggle={() => undefined}
            onPageStyleChange={handlePageStyleChange}
            onOpenTheme={handleOpenThemeDialog}
            onOpenGlobalCss={handleOpenGlobalCssDialog}
            showPin={false}
            className="h-full w-full rounded-none border-none shadow-none"
          />
        </SheetContent>
      </Sheet>

      <Dialog open={isThemeDialogOpen} onOpenChange={setIsThemeDialogOpen}>
        <DialogContent className="max-w-5xl gap-0 overflow-hidden border-[#1d212b] bg-[#0f1117] p-0 text-white">
          <div className="border-b border-[#1d212b] px-6 py-4">
            <DialogHeader>
              <DialogTitle className="text-left text-base font-semibold text-white">Edit theme</DialogTitle>
              <DialogDescription className="text-left text-white/45">
                Edite o JSON salvo em `globalContent.attrs.data.__leadFlow.theme`.
              </DialogDescription>
            </DialogHeader>
          </div>
          <div className="space-y-4 px-6 py-5">
            <div className="rounded-2xl border border-[#1d212b] bg-[#12141b] p-3 text-sm text-white/60">
              Use um objeto JSON para guardar tokens e presets do editor. Alterações válidas são persistidas imediatamente no `mailyJson`.
            </div>
            <div className="h-[60vh] overflow-hidden rounded-[20px] border border-[#1d212b] bg-[#05050A]">
              <MonacoCodeEditor
                value={themeEditorValue}
                onChange={handleThemeChange}
                language="json"
                height="100%"
                className="h-full"
                themeVariant="resend-dark"
              />
            </div>
            {themeEditorError ? <p className="text-sm text-red-400">{themeEditorError}</p> : null}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={isGlobalCssDialogOpen} onOpenChange={setIsGlobalCssDialogOpen}>
        <DialogContent className="max-w-5xl gap-0 overflow-hidden border-[#1d212b] bg-[#0f1117] p-0 text-white">
          <div className="border-b border-[#1d212b] px-6 py-4">
            <DialogHeader>
              <DialogTitle className="text-left text-base font-semibold text-white">Global CSS</DialogTitle>
              <DialogDescription className="text-left text-white/45">
                CSS global aplicado ao preview HTML e persistido em `globalContent.attrs.data.__leadFlow.globalCss`.
              </DialogDescription>
            </DialogHeader>
          </div>
          <div className="space-y-4 px-6 py-5">
            <div className="rounded-2xl border border-[#1d212b] bg-[#12141b] p-4 text-sm text-white/60">
              <p className="font-medium text-white/78">You can style your email using global selectors:</p>
              <pre className="mt-3 whitespace-pre-wrap font-mono text-[12px] leading-6 text-white/55">{`p { color: red; }\n\n.example { color: blue; }\n\n@media screen and (max-width: 600px) {\n  .stack {\n    display: block;\n  }\n}`}</pre>
            </div>
            <div className="h-[60vh] overflow-hidden rounded-[20px] border border-[#1d212b] bg-[#05050A]">
              <MonacoCodeEditor
                value={globalCssValue}
                onChange={handleGlobalCssChange}
                language="css"
                height="100%"
                className="h-full"
                themeVariant="resend-dark"
              />
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={testEmailOpen} onOpenChange={setTestEmailOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Enviar email de teste</DialogTitle>
            <DialogDescription>
              Envia o template com o assunto atual para o endereço informado.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="test-email">Destinatário</Label>
            <Input
              id="test-email"
              type="email"
              placeholder="seu@email.com"
              value={testEmailAddress}
              onChange={(event) => setTestEmailAddress(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') handleSendTest()
              }}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTestEmailOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSendTest} disabled={sendingTest || !testEmailAddress.trim()}>
              {sendingTest ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Enviar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir template?</AlertDialogTitle>
            <AlertDialogDescription>
              Essa ação remove o template permanentemente. Você não poderá desfazer depois.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
