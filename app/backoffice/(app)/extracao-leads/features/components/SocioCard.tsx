"use client"

import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Building2 } from "lucide-react"
import type { SocioResultItem } from "../services/IBackofficeLeadExtractionService"

const PERSON_TYPE_LABEL: Record<string, string> = {
  NATURAL: "Pessoa física",
  LEGAL: "Pessoa jurídica",
  FOREIGN: "Estrangeira",
  UNKNOWN: "Desconhecida",
}

function formatDate(iso: string): string {
  if (!iso) return "—"
  const [y, m, d] = iso.split("-")
  if (!y || !m || !d) return iso
  return `${d}/${m}/${y}`
}

function formatCompanyId(id: number): string {
  return String(id).padStart(8, "0")
}

interface Props {
  socio: SocioResultItem
}

export function SocioCard({ socio }: Props) {
  return (
    <div className="border-b px-5 py-4 last:border-b-0">
      {/* Cabeçalho do sócio */}
      <div className="mb-3 flex flex-wrap items-start gap-2">
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold">{socio.name}</p>
          {socio.taxId && (
            <p className="mt-0.5 text-xs text-muted-foreground font-mono">{socio.taxId}</p>
          )}
        </div>
        <div className="flex shrink-0 flex-wrap gap-1.5">
          <Badge variant="secondary">{PERSON_TYPE_LABEL[socio.type] ?? socio.type}</Badge>
          {socio.age && (
            <Badge variant="outline">{socio.age} anos</Badge>
          )}
        </div>
      </div>

      {/* Vínculos empresariais */}
      {socio.membership.length > 0 && (
        <div className="rounded-lg border bg-muted/40 p-3">
          <div className="mb-2 flex items-center gap-1.5">
            <Building2 className="size-3.5 text-muted-foreground" />
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              Vínculos empresariais ({socio.membership.length})
            </p>
          </div>
          <div className="flex flex-col gap-2">
            {socio.membership.map((m, i) => (
              <div key={i}>
                {i > 0 && <Separator className="mb-2" />}
                <p className="text-sm font-medium leading-tight">{m.company.name}</p>
                <p className="mt-0.5 text-xs text-muted-foreground font-mono">
                  {formatCompanyId(m.company.id)}
                </p>
                <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5">
                  <span className="text-xs text-muted-foreground">{m.role.text}</span>
                  <span className="text-xs text-muted-foreground">Desde {formatDate(m.since)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {socio.membership.length === 0 && (
        <p className="text-xs text-muted-foreground italic">Sem vínculos empresariais registrados</p>
      )}
    </div>
  )
}
