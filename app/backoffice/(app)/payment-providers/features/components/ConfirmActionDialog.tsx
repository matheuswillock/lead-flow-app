"use client"

import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"

export interface PendingConfirmation {
  title: string
  description: string
  confirmLabel: string
  run: () => Promise<unknown>
}

interface Props {
  pending: PendingConfirmation | null
  isBusy: boolean
  onClose: () => void
}

export function ConfirmActionDialog({ pending, isBusy, onClose }: Props) {
  async function runPendingAction() {
    if (!pending || isBusy) return
    await pending.run()
    onClose()
  }

  return (
    <AlertDialog open={pending !== null} onOpenChange={(open) => !open && !isBusy && onClose()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{pending?.title}</AlertDialogTitle>
          <AlertDialogDescription>{pending?.description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isBusy} className="max-lg:h-11">
            Cancelar
          </AlertDialogCancel>
          <Button type="button" onClick={runPendingAction} disabled={isBusy} className="max-lg:h-11">
            {pending?.confirmLabel}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
