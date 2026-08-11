"use client"

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"

type PromoteRadarProfileAlertDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  displayName: string
  primaryEmail?: string | null
  isPromoting: boolean
  onConfirm: () => Promise<void>
}

export function PromoteRadarProfileAlertDialog({
  open,
  onOpenChange,
  displayName,
  primaryEmail,
  isPromoting,
  onConfirm,
}: PromoteRadarProfileAlertDialogProps) {
  return (
    <AlertDialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (isPromoting) return
        onOpenChange(nextOpen)
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Promover perfil a Lead?</AlertDialogTitle>
          <AlertDialogDescription>
            Será criado um Lead novo no CRM a partir dos dados deste perfil Radar ({displayName}
            {primaryEmail ? ` · ${primaryEmail}` : ""}). O perfil passará a exibir o vínculo com o
            Lead criado.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPromoting}>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            disabled={isPromoting}
            onClick={(event) => {
              event.preventDefault()
              void onConfirm()
            }}
          >
            {isPromoting ? "Promovendo…" : "Confirmar promoção"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
