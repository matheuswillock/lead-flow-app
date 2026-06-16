'use client'

import { useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { ArrowRight, Check, Copy, Mail, MoreHorizontal, Pencil, Trash2, X } from 'lucide-react'
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
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Spinner } from '@/components/ui/spinner'
import type { Template } from '../context/TemplatesTypes'

function getBannerGradientIndex(id: string): number {
  const sum = id.split('').reduce((acc, ch) => acc + ch.charCodeAt(0), 0)
  return sum % 8
}

interface TemplateCardProps {
  template: Template
  activeRole: 'manager' | 'backoffice' | 'operator' | null
  deleting: string | null
  duplicating: string | null
  submitting: string | null
  approving: string | null
  rejecting: string | null
  onDelete: (id: string) => Promise<void>
  onDuplicate: (id: string) => Promise<void>
  onSubmitForApproval: (id: string) => Promise<void>
  onApprove: (id: string) => Promise<void>
  onReject: (id: string, reviewNote: string) => Promise<void>
}

function StatusBadge({ template }: { template: Template }) {
  if (template.status === 'published') {
    return (
      <Badge variant="outline" className="h-5 gap-1 border-semantic-success/30 bg-semantic-success/10 px-1.5 text-[10px] text-semantic-success">
        Publicado
      </Badge>
    )
  }
  if (template.approvalStatus === 'pending_approval') {
    return (
      <Badge variant="outline" className="h-5 gap-1 border-warning/30 bg-warning/10 px-1.5 text-[10px] text-warning">
        Aguard. aprovação
      </Badge>
    )
  }
  if (template.approvalStatus === 'rejected') {
    return (
      <Badge variant="outline" className="h-5 gap-1 border-destructive/30 bg-destructive/10 px-1.5 text-[10px] text-destructive">
        Recusado
      </Badge>
    )
  }
  return (
    <Badge variant="secondary" className="h-5 px-1.5 text-[10px]">
      Rascunho
    </Badge>
  )
}

export function TemplateCard({
  template,
  activeRole,
  deleting,
  duplicating,
  submitting,
  approving,
  rejecting,
  onDelete,
  onDuplicate,
  onSubmitForApproval,
  onApprove,
  onReject,
}: TemplateCardProps) {
  const router = useRouter()
  const params = useParams()
  const supabaseId = params.supabaseId as string
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [rejectOpen, setRejectOpen] = useState(false)
  const [reviewNote, setReviewNote] = useState('')

  const isDeleting = deleting === template.id
  const isDuplicating = duplicating === template.id
  const isSubmitting = submitting === template.id
  const isApproving = approving === template.id
  const isRejecting = rejecting === template.id
  const isBusy = isDeleting || isDuplicating || isSubmitting || isApproving || isRejecting

  const isManager = activeRole === 'manager'
  const isPending = template.approvalStatus === 'pending_approval'
  const isRejectedStatus = template.approvalStatus === 'rejected'
  const isDraft = template.status === 'draft' && template.approvalStatus === 'approved'
  const isPublished = template.status === 'published'

  const creatorLabel = template.creator?.fullName?.trim() || template.creator?.email || '—'

  const handleEdit = () => {
    router.push(`/${supabaseId}/email/templates/${template.id}`)
  }

  const handleConfirmDelete = async () => {
    setDeleteOpen(false)
    await onDelete(template.id)
  }

  const handleConfirmReject = async () => {
    if (!reviewNote.trim()) return
    await onReject(template.id, reviewNote.trim())
    setRejectOpen(false)
    setReviewNote('')
  }

  const showSubmitButton = !isManager && (isDraft || isRejectedStatus)
  const showApproveReject = isManager && isPending

  return (
    <>
      <div
        className="group relative flex flex-col overflow-hidden rounded-lg border bg-card transition-shadow hover:shadow-md cursor-pointer"
        onClick={handleEdit}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => { if (e.key === 'Enter') handleEdit() }}
      >
        {/* Banner */}
        <div
          className="relative flex h-32 w-full items-center justify-center overflow-hidden"
          data-banner-gradient={String(getBannerGradientIndex(template.id))}
        >
          <p className="z-10 px-4 text-center text-sm font-semibold leading-tight text-white drop-shadow">
            {template.name}
          </p>
          <Mail className="absolute bottom-2.5 right-2.5 size-7 text-white/30" />
        </div>

        {/* Footer */}
        <div className="flex flex-col gap-1.5 border-t bg-card px-3 py-2.5">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{template.name}</p>
              <p className="truncate text-xs text-muted-foreground">{template.subject}</p>
              <p className="truncate text-xs text-muted-foreground">Por {creatorLabel}</p>
            </div>
            <div className="flex shrink-0 items-center gap-1">
              <StatusBadge template={template} />
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="size-7 opacity-0 group-hover:opacity-100"
                    onClick={(e) => e.stopPropagation()}
                    disabled={isBusy}
                  >
                    <MoreHorizontal className="size-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                  <DropdownMenuItem onClick={handleEdit}>
                    <Pencil className="mr-2 size-3.5" />
                    Editar
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => void onDuplicate(template.id)} disabled={isBusy}>
                    <Copy className="mr-2 size-3.5" />
                    {isDuplicating ? 'Duplicando...' : 'Duplicar'}
                  </DropdownMenuItem>
                  {showApproveReject && (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        onClick={() => void onApprove(template.id)}
                        disabled={isApproving}
                        className="text-semantic-success focus:text-semantic-success"
                      >
                        {isApproving ? <Spinner className="mr-2 size-3.5" /> : <Check className="mr-2 size-3.5" />}
                        Aprovar
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => { setRejectOpen(true) }}
                        disabled={isRejecting}
                        className="text-destructive focus:text-destructive"
                      >
                        <X className="mr-2 size-3.5" />
                        Rejeitar
                      </DropdownMenuItem>
                    </>
                  )}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    className="text-destructive focus:text-destructive"
                    disabled={isBusy}
                    onClick={() => setDeleteOpen(true)}
                  >
                    <Trash2 className="mr-2 size-3.5" />
                    {isDeleting ? 'Excluindo...' : 'Excluir'}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>

          {/* Rejection reason */}
          {isRejectedStatus && template.reviewNote && (
            <div
              className="rounded-md border border-destructive/30 bg-destructive/10 px-2.5 py-2 text-xs text-destructive"
              onClick={(e) => e.stopPropagation()}
            >
              <strong>Motivo:</strong> {template.reviewNote}
            </div>
          )}

          {/* Submit for approval button */}
          {showSubmitButton && !isPublished && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="w-full text-xs"
              disabled={isSubmitting || isBusy}
              onClick={(e) => { e.stopPropagation(); void onSubmitForApproval(template.id) }}
            >
              {isSubmitting
                ? <Spinner data-icon="inline-start" />
                : <ArrowRight data-icon="inline-start" />}
              {isRejectedStatus ? 'Reenviar para aprovação' : 'Enviar para aprovação'}
            </Button>
          )}
        </div>
      </div>

      {/* Delete dialog */}
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

      {/* Reject dialog */}
      <Dialog open={rejectOpen} onOpenChange={(open) => { setRejectOpen(open); if (!open) setReviewNote('') }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Recusar template</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-2" onClick={(e) => e.stopPropagation()}>
            <Label htmlFor="review-note">Motivo da recusa <span className="text-primary">*</span></Label>
            <Textarea
              id="review-note"
              placeholder="Descreva o que precisa ser ajustado..."
              value={reviewNote}
              onChange={(e) => setReviewNote(e.target.value)}
              maxLength={500}
              rows={4}
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setRejectOpen(false)}>Cancelar</Button>
            <Button
              type="button"
              variant="destructive"
              disabled={!reviewNote.trim() || isRejecting}
              onClick={() => void handleConfirmReject()}
            >
              {isRejecting ? <Spinner data-icon="inline-start" /> : null}
              Confirmar recusa
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
