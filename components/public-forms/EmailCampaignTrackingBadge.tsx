import { Mail } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"

type Props = {
  className?: string
  enabled?: boolean
}

/**
 * Indica que o formulário aceita atribuição de campanha de e-mail (`cs_el` / EmailLog.id).
 */
export function EmailCampaignTrackingBadge({ className, enabled = true }: Props) {
  if (!enabled) return null

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge variant="outline" className={cn("gap-1", className)}>
            <Mail className="size-3.5" aria-hidden />
            Atribuição de e-mail
          </Badge>
        </TooltipTrigger>
        <TooltipContent>
          Rastreia abertura e preenchimento a partir de campanhas de e-mail (parâmetro cs_el).
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}
