"use client"

import * as React from "react"

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

export type ConfirmDeleteRequest = {
  title: string
  description: React.ReactNode
  /** Rótulo do botão destrutivo. Padrão: "Excluir". */
  confirmLabel?: string
  onConfirm: () => void | Promise<unknown>
}

/**
 * Regra do produto: toda exclusão pergunta "tem certeza?" antes de agir. O hook devolve a função que
 * abre a pergunta e o elemento do diálogo, que o componente renderiza uma vez.
 */
export function useConfirmDelete() {
  const [request, setRequest] = React.useState<ConfirmDeleteRequest | null>(null)

  const confirmDelete = React.useCallback((next: ConfirmDeleteRequest) => setRequest(next), [])

  const dialog = (
    <AlertDialog open={request !== null} onOpenChange={(open) => !open && setRequest(null)}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{request?.title}</AlertDialogTitle>
          <AlertDialogDescription>{request?.description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Voltar</AlertDialogCancel>
          <AlertDialogAction
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            onClick={() => {
              const action = request?.onConfirm
              setRequest(null)
              void action?.()
            }}
          >
            {request?.confirmLabel ?? "Excluir"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )

  return { confirmDelete, dialog }
}
