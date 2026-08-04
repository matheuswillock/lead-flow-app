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

type CampaignListStrategyDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSelectStrategy: (strategy: "merge" | "per_list") => void
}

export function CampaignListStrategyDialog({
  open,
  onOpenChange,
  onSelectStrategy,
}: CampaignListStrategyDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="max-w-md overflow-y-auto">
        <AlertDialogHeader>
          <AlertDialogTitle>Como deseja usar estas listas?</AlertDialogTitle>
          <AlertDialogDescription>
            Escolha se deseja unificar os contatos ou manter uma sub-campanha por lista.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="flex flex-col gap-2">
          <AlertDialogAction
            className="h-auto whitespace-normal py-3 text-left"
            onClick={() => onSelectStrategy("merge")}
          >
            Juntar listas — unifica contatos (dedup) e divide em lotes de até 2.000
          </AlertDialogAction>
          <AlertDialogAction
            className="h-auto whitespace-normal py-3 text-left"
            onClick={() => onSelectStrategy("per_list")}
          >
            Uma sub-campanha por lista — cada lista vira ao menos uma sub-campanha
          </AlertDialogAction>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
