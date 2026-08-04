"use client"

import { Mail, Phone } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import type { LeadExtractionResultItem } from "../services/IBackofficeLeadExtractionService"

interface Props {
  company: LeadExtractionResultItem
}

function typeBadgeVariant(type: string | null): "default" | "secondary" | "outline" {
  if (!type) return "secondary"
  const t = type.toUpperCase()
  if (t.includes("MEI")) return "default"
  if (t.includes("ME") || t.includes("MICRO")) return "outline"
  return "secondary"
}

export function CompanyCard({ company }: Props) {
  const typeLabel = company.type?.toUpperCase().includes("MICROEMPREENDEDOR")
    ? "MEI"
    : company.type?.toUpperCase().includes("MICRO")
    ? "ME"
    : (company.type ?? null)

  return (
    <div className="flex items-center gap-3 border-b px-5 py-3 transition-colors last:border-b-0 hover:bg-muted/40">
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex flex-wrap items-center gap-2">
          <span className="truncate text-sm font-semibold">{company.name}</span>
          {typeLabel && (
            <Badge variant={typeBadgeVariant(company.type)} className="shrink-0 text-xs">
              {typeLabel}
            </Badge>
          )}
        </div>
        <p className="mt-0.5 text-xs text-muted-foreground">
          {[company.city, company.state].filter(Boolean).join(" ")}
          {company.cnaeName && (
            <span className="before:mx-1.5 before:content-['·']">{company.cnaeName}</span>
          )}
        </p>
      </div>

      <div className="flex shrink-0 items-center gap-1.5">
        <Button
          variant="outline"
          size="icon"
          className={cn("size-8", !company.phone && "opacity-40")}
          disabled={!company.phone}
          title={company.phone ? `Telefone: ${company.phone}` : "Sem telefone"}
        >
          <Phone className="size-3.5" />
        </Button>
        <Button
          variant="outline"
          size="icon"
          className={cn("size-8", !company.email && "opacity-40")}
          disabled={!company.email}
          title={company.email ? `E-mail: ${company.email}` : "Sem e-mail"}
        >
          <Mail className="size-3.5" />
        </Button>
      </div>

      <span className="shrink-0 text-xs font-medium text-primary">
        {company.taxId}
      </span>
    </div>
  )
}
