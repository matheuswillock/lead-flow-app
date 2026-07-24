import { Badge } from "@/components/ui/badge"

export function ManagedByCorretorStudioBadge({ className }: { className?: string }) {
  return (
    <Badge variant="outline" className={className}>
      Gerenciado pelo Corretor Studio
    </Badge>
  )
}
