"use client"

import { format } from "date-fns"
import { ptBR } from "date-fns/locale"
import { Loader2, Mail, Phone } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { Skeleton } from "@/components/ui/skeleton"
import { useLeadDetails } from "@/hooks/useLeadDetails"
import { getLeadStatusLabel } from "@/lib/lead-status"
import { maskPhone } from "@/lib/masks"

interface LeadDetailsSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  leadId: string | null
  teamId: string | null
  supabaseId: string
}

function DetailRow({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value?.trim()) return null
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      <span className="text-sm text-foreground">{value}</span>
    </div>
  )
}

export function LeadDetailsSheet({
  open,
  onOpenChange,
  leadId,
  teamId,
  supabaseId,
}: LeadDetailsSheetProps) {
  const { details, loading, error } = useLeadDetails(open ? leadId : null, teamId, supabaseId)
  const lead = details?.lead

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="flex w-full flex-col gap-0 p-0 sm:max-w-md">
        <SheetHeader className="border-b px-6 py-4 text-left">
          {loading ? (
            <>
              <SheetTitle className="sr-only">Carregando lead</SheetTitle>
              <Skeleton className="h-6 w-40" />
              <Skeleton className="mt-2 h-4 w-24" />
            </>
          ) : (
            <>
              <SheetTitle>{lead?.name ?? "Lead"}</SheetTitle>
              <SheetDescription asChild>
                <div className="flex items-center gap-2">
                  <span>{lead?.leadCode ?? "—"}</span>
                  {lead?.status ? (
                    <Badge variant="secondary" className="text-xs">
                      {getLeadStatusLabel(lead.status)}
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="text-xs">
                      Rascunho
                    </Badge>
                  )}
                </div>
              </SheetDescription>
            </>
          )}
        </SheetHeader>

        <div className="flex flex-1 flex-col gap-4 overflow-y-auto px-6 py-5">
          {loading ? (
            <div className="flex items-center justify-center py-10">
              <Loader2 className="size-6 animate-spin text-muted-foreground" />
            </div>
          ) : error ? (
            <p className="text-sm text-destructive">{error}</p>
          ) : !lead ? (
            <p className="text-sm text-muted-foreground">Lead não encontrado.</p>
          ) : (
            <>
              <div className="flex flex-col gap-3">
                {lead.phone ? (
                  <div className="flex items-center gap-2 text-sm">
                    <Phone className="size-4 text-muted-foreground" />
                    <span>{maskPhone(lead.phone.replace(/\D/g, ""))}</span>
                  </div>
                ) : null}
                {lead.email ? (
                  <div className="flex items-center gap-2 text-sm">
                    <Mail className="size-4 text-muted-foreground" />
                    <span>{lead.email}</span>
                  </div>
                ) : null}
              </div>

              <Separator />

              <div className="flex flex-col gap-4">
                <DetailRow label="Operador" value={lead.assignee?.fullName ?? lead.assignee?.email ?? null} />
                <DetailRow label="Closer" value={lead.closer?.fullName ?? lead.closer?.email ?? null} />
                <DetailRow
                  label="Reunião"
                  value={
                    lead.meetingDate
                      ? format(new Date(lead.meetingDate), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })
                      : null
                  }
                />
                <DetailRow label="Plano atual" value={lead.currentHealthPlan} />
                <DetailRow label="Observações" value={lead.notes} />
              </div>
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}
