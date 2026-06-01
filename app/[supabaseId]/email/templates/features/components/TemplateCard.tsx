'use client'

import { useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { Copy, MoreHorizontal, Pencil, Trash2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
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
import { Template } from '../context/TemplatesTypes'

interface TemplateCardProps {
  template: Template
  deleting: string | null
  duplicating: string | null
  onDelete: (id: string) => Promise<void>
  onDuplicate: (id: string) => Promise<void>
}

function HtmlPreview({ html }: { html: string | null }) {
  const content = html || '<div style="display:flex;align-items:center;justify-content:center;height:100%;color:#aaa;font-family:sans-serif;font-size:13px;">Sem prévia</div>'
  return (
    <div className="relative h-36 w-full overflow-hidden rounded-t-lg bg-white">
      <iframe
        srcDoc={content}
        title="preview"
        sandbox="allow-same-origin"
        className="pointer-events-none absolute left-0 top-0 origin-top-left border-0"
        style={{
          width: '600px',
          height: '400px',
          transform: 'scale(0.46)',
          transformOrigin: 'top left',
        }}
      />
    </div>
  )
}

export function TemplateCard({
  template,
  deleting,
  duplicating,
  onDelete,
  onDuplicate,
}: TemplateCardProps) {
  const router = useRouter()
  const params = useParams()
  const supabaseId = params.supabaseId as string
  const [deleteOpen, setDeleteOpen] = useState(false)
  const isDeleting = deleting === template.id
  const isDuplicating = duplicating === template.id
  const isBusy = isDeleting || isDuplicating

  const handleEdit = () => {
    router.push(`/${supabaseId}/email/templates/${template.id}`)
  }

  const handleConfirmDelete = async () => {
    setDeleteOpen(false)
    await onDelete(template.id)
  }

  const handleDuplicate = async () => {
    await onDuplicate(template.id)
  }

  return (
    <>
      <div
        className="group relative flex flex-col overflow-hidden rounded-lg border bg-card transition-shadow hover:shadow-md cursor-pointer"
        onClick={handleEdit}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => { if (e.key === 'Enter') handleEdit() }}
      >
        {/* Preview thumbnail */}
        <HtmlPreview html={template.html} />

        {/* Footer */}
        <div className="flex items-center justify-between gap-2 border-t bg-card px-3 py-2.5">
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{template.name}</p>
            <p className="truncate text-xs text-muted-foreground">{template.subject}</p>
          </div>

          <div className="flex shrink-0 items-center gap-1.5">
            <Badge variant="secondary" className="text-[10px] h-5 px-1.5">
              Template
            </Badge>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 opacity-0 group-hover:opacity-100"
                  onClick={(e) => e.stopPropagation()}
                  disabled={isBusy}
                >
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                <DropdownMenuItem onClick={handleEdit}>
                  <Pencil className="mr-2 h-3.5 w-3.5" />
                  Editar
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleDuplicate} disabled={isBusy}>
                  <Copy className="mr-2 h-3.5 w-3.5" />
                  {isDuplicating ? 'Duplicando...' : 'Duplicar'}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="text-destructive focus:text-destructive"
                  disabled={isBusy}
                  onClick={() => setDeleteOpen(true)}
                >
                  <Trash2 className="mr-2 h-3.5 w-3.5" />
                  {isDeleting ? 'Excluindo...' : 'Excluir'}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir template?</AlertDialogTitle>
            <AlertDialogDescription>
              O template <strong>"{template.name}"</strong> será excluído permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
