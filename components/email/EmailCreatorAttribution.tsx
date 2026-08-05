import { formatEmailCreatorLabel } from "@/lib/email/format-email-creator"
import { cn } from "@/lib/utils"

type Props = {
  item: {
    creator?: { fullName?: string | null; email?: string | null } | null
    managedByCorretorStudio?: boolean
  }
  prefix?: string
  className?: string
}

export function EmailCreatorAttribution({
  item,
  prefix = "Criado por:",
  className,
}: Props) {
  const label = formatEmailCreatorLabel(item)

  return (
    <p className={cn("truncate text-xs text-muted-foreground leading-snug", className)}>
      {prefix} {label}
    </p>
  )
}
