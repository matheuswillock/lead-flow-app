import { Sparkles } from "lucide-react"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"

export const PREFILL_FIELD_INDICATOR_MESSAGE =
  "Preenchido automaticamente a partir do seu cadastro. Confira e corrija se não for você."

/**
 * Indicador do item A (registro 03/09): campo preenchido pelo prefill de
 * `cs_el` ganha um ícone com aviso. Trigger é um `<button>` real — foco por
 * teclado e toque abrem o tooltip do mesmo jeito que o hover no desktop.
 */
export function PrefillFieldIndicator() {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            aria-label={PREFILL_FIELD_INDICATOR_MESSAGE}
            className="inline-flex shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <Sparkles className="size-4" aria-hidden="true" />
          </button>
        </TooltipTrigger>
        <TooltipContent>{PREFILL_FIELD_INDICATOR_MESSAGE}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}
