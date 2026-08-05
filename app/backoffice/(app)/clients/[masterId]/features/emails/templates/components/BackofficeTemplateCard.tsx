"use client"

import Link from "next/link"
import { Mail } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { EmailCreatorAttribution } from "@/components/email/EmailCreatorAttribution"
import type { StudioEmailTemplate } from "../../services/IBackofficeStudioEmailService"

function getBannerGradientIndex(id: string): number {
  const sum = id.split("").reduce((acc, ch) => acc + ch.charCodeAt(0), 0)
  return sum % 8
}

function StatusBadge({ template }: { template: StudioEmailTemplate }) {
  if (template.status === "published") {
    return (
      <Badge variant="outline" className="h-5 border-semantic-success/30 bg-semantic-success/10 px-1.5 text-[10px] text-semantic-success">
        Publicado
      </Badge>
    )
  }
  if (template.approvalStatus === "pending_approval") {
    return (
      <Badge variant="outline" className="h-5 border-warning/30 bg-warning/10 px-1.5 text-[10px] text-warning">
        Aguardando
      </Badge>
    )
  }
  return (
    <Badge variant="secondary" className="h-5 px-1.5 text-[10px]">
      Rascunho
    </Badge>
  )
}

type Props = {
  template: StudioEmailTemplate
  masterId: string
  teamId: string
}

export function BackofficeTemplateCard({ template, masterId, teamId }: Props) {
  const href = `/backoffice/clients/${masterId}/emails/templates/${template.id}?teamId=${teamId}`

  return (
    <Link
      href={href}
      className="group flex flex-col overflow-hidden rounded-lg border bg-card transition-shadow hover:shadow-md"
    >
      <div
        className="relative flex h-32 w-full items-center justify-center overflow-hidden"
        data-banner-gradient={String(getBannerGradientIndex(template.id))}
      >
        <p className="z-10 px-4 text-center text-sm font-semibold leading-tight text-white drop-shadow">
          {template.name}
        </p>
        <Mail className="absolute bottom-2.5 right-2.5 size-7 text-white/30" />
      </div>
      <div className="flex flex-col gap-1.5 border-t px-3 py-2.5">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{template.name}</p>
            <p className="truncate text-xs text-muted-foreground">{template.subject}</p>
            <EmailCreatorAttribution item={template} prefix="Por" />
          </div>
          <StatusBadge template={template} />
        </div>
      </div>
    </Link>
  )
}
