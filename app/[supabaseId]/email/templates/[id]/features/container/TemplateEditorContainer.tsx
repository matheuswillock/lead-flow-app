'use client'

import { useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import {
  Pencil,
  Code2,
  ChevronRight,
  Loader2,
  MoreHorizontal,
  Mail,
  Copy,
  Users,
  Trash2,
} from 'lucide-react'
import { toast } from 'sonner'
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
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useTemplateEditorContext } from '../context/TemplateEditorContext'
import { MailyEditor } from '../components/MailyEditor'
import { HtmlEditor } from '../components/HtmlEditor'
import { EditorMode } from '../context/TemplateEditorTypes'

function IconSidebarButton({
  active,
  title,
  onClick,
  children,
}: {
  active: boolean
  title: string
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className={`w-8 h-8 flex items-center justify-center rounded-md transition-colors ${
        active
          ? 'bg-white/20 text-white'
          : 'text-white/40 hover:text-white/70 hover:bg-white/10'
      }`}
    >
      {children}
    </button>
  )
}

export function TemplateEditorContainer() {
  const router = useRouter()
  const params = useParams()
  const supabaseId = params.supabaseId as string
  const templateId = params.id as string
  const isNew = templateId === 'new'

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

  const [testEmailOpen, setTestEmailOpen] = useState(false)
  const [testEmailAddress, setTestEmailAddress] = useState('')
  const [sendingTest, setSendingTest] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [duplicating, setDuplicating] = useState(false)

  const handleBack = () => {
    router.push(`/${supabaseId}/email/templates`)
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
      const res = await fetch(`/api/v1/email/templates/${templateId}/test`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to: testEmailAddress.trim() }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error ?? 'Erro ao enviar email de teste')
      }
      toast.success('Email de teste enviado', { description: testEmailAddress.trim() })
      setTestEmailOpen(false)
      setTestEmailAddress('')
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao enviar email de teste'
      console.error('[TemplateEditorContainer] sendTest error', err)
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
      const res = await fetch(`/api/v1/email/templates`, {
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
      if (!res.ok) throw new Error('Erro ao duplicar template')
      const data = await res.json()
      toast.success('Template duplicado')
      router.push(`/${supabaseId}/email/templates/${data.result.id}`)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao duplicar template'
      console.error('[TemplateEditorContainer] duplicate error', err)
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
      const res = await fetch(`/api/v1/email/templates/${templateId}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Erro ao excluir template')
      toast.success('Template excluído')
      router.push(`/${supabaseId}/email/templates`)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao excluir template'
      console.error('[TemplateEditorContainer] delete error', err)
      toast.error('Erro ao excluir template', { description: message })
    } finally {
      setDeleting(false)
      setDeleteOpen(false)
    }
  }

  if (loading) {
    return (
      <div className="flex h-screen bg-[#1f1f1f]">
        <div className="w-12 bg-[#252525] border-r border-white/10 shrink-0" />
        <div className="flex-1 flex flex-col">
          <div className="h-10 bg-[#252525] border-b border-white/10 flex items-center px-4 gap-2">
            <Skeleton className="h-4 w-48 bg-white/10" />
          </div>
          <div className="flex-1 flex items-center justify-center">
            <Skeleton className="h-[600px] w-[600px] bg-white/5 rounded-lg" />
          </div>
        </div>
      </div>
    )
  }

  return (
    <>
      <div className="flex h-screen bg-[#1f1f1f]">
        {/* Left icon sidebar */}
        <div className="w-12 flex flex-col items-center pt-3 gap-1 bg-[#252525] border-r border-white/10 shrink-0">
          <IconSidebarButton
            active={mode === 'maily'}
            title="Editor visual (Maily)"
            onClick={() => setMode('maily' as EditorMode)}
          >
            <Pencil className="h-4 w-4" />
          </IconSidebarButton>
          <IconSidebarButton
            active={mode === 'html'}
            title="Editor HTML"
            onClick={() => setMode('html' as EditorMode)}
          >
            <Code2 className="h-4 w-4" />
          </IconSidebarButton>
        </div>

        {/* Main area */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Top bar */}
          <div className="flex items-center gap-1.5 px-4 h-10 bg-[#252525] border-b border-white/10 shrink-0">
            <button
              type="button"
              onClick={handleBack}
              className="text-white/50 hover:text-white/80 text-sm transition-colors whitespace-nowrap"
            >
              Templates
            </button>
            <ChevronRight className="h-3.5 w-3.5 text-white/30 shrink-0" />
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Nome do template"
              className="bg-transparent text-white/90 text-sm outline-none placeholder:text-white/30 min-w-0 flex-1"
            />

            <div className="flex items-center gap-1.5 ml-2 shrink-0">
              {/* Three-dots menu */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    disabled={duplicating || deleting}
                    className="w-7 h-7 flex items-center justify-center rounded-md text-white/50 hover:text-white/80 hover:bg-white/10 transition-colors disabled:opacity-40"
                  >
                    <MoreHorizontal className="h-4 w-4" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-52">
                  <DropdownMenuItem
                    onClick={() => setTestEmailOpen(true)}
                    disabled={isNew}
                  >
                    <Mail className="mr-2 h-4 w-4" />
                    Enviar email de teste
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={handleDuplicate}
                    disabled={isNew || duplicating}
                  >
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

              <Button
                size="sm"
                onClick={handleSave}
                disabled={saving}
                className="h-7 px-3 text-xs"
              >
                {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Salvar'}
              </Button>
            </div>
          </div>

          {/* Editor content */}
          <div className="flex-1 overflow-hidden">
            {mode === 'maily' ? (
              <MailyEditor
                value={mailyJson}
                subject={subject}
                previewText={previewText}
                onChangeSubject={setSubject}
                onChangePreviewText={setPreviewText}
                onChange={handleMailyChange}
              />
            ) : (
              <HtmlEditor value={html} onChange={setHtml} />
            )}
          </div>
        </div>
      </div>

      {/* Test email dialog */}
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
              onChange={(e) => setTestEmailAddress(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleSendTest() }}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTestEmailOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={handleSendTest}
              disabled={sendingTest || !testEmailAddress.trim()}
            >
              {sendingTest ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Enviar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir template?</AlertDialogTitle>
            <AlertDialogDescription>
              O template <strong>"{name}"</strong> será excluído permanentemente. Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? 'Excluindo...' : 'Excluir'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
