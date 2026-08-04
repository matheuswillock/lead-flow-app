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
import { buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"

type CampaignListStrategyDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSelectStrategy: (strategy: "merge" | "per_list") => void
}

const optionButtonClassName = cn(
  buttonVariants({ variant: "outline" }),
  "h-auto w-full flex-col items-start justify-start gap-1 whitespace-normal px-4 py-3 text-left shadow-none"
)

export function CampaignListStrategyDialog({
  open,
  onOpenChange,
  onSelectStrategy,
}: CampaignListStrategyDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="max-h-[90vh] flex flex-col gap-4 overflow-hidden sm:max-w-md">
        <AlertDialogHeader className="shrink-0 gap-2 space-y-0 text-left">
          <AlertDialogTitle>Como deseja usar estas listas?</AlertDialogTitle>
          <AlertDialogDescription>
            Escolha se deseja unificar os contatos ou manter uma sub-campanha por
            lista.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="flex flex-1 flex-col gap-2 overflow-y-auto">
          <AlertDialogAction
            className={optionButtonClassName}
            onClick={() => onSelectStrategy("merge")}
          >
            <span className="w-full font-medium">Juntar listas</span>
            <span className="w-full text-sm font-normal text-muted-foreground whitespace-normal">
              Unifica contatos (dedup) e divide em lotes de até 2.000.
            </span>
          </AlertDialogAction>

          <AlertDialogAction
            className={optionButtonClassName}
            onClick={() => onSelectStrategy("per_list")}
          >
            <span className="w-full font-medium">Uma sub-campanha por lista</span>
            <span className="w-full text-sm font-normal text-muted-foreground whitespace-normal">
              Cada lista vira ao menos uma sub-campanha.
            </span>
          </AlertDialogAction>
        </div>

        <AlertDialogFooter className="shrink-0 flex-col gap-2 sm:flex-col sm:space-x-0">
          <AlertDialogCancel className="mt-0 w-full sm:w-full">
            Cancelar
          </AlertDialogCancel>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
