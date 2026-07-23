"use client"

import { Badge } from "@/components/ui/badge"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import type { RadarProfileListItem } from "../context/RadarTypes"

export function EligibilityBadge({ profile }: { profile: RadarProfileListItem }) {
  const emailConsent = profile.consents.find((c) => c.channel === "email")
  if (emailConsent?.status === "blocked") {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge variant="destructive">Bloqueado</Badge>
        </TooltipTrigger>
        <TooltipContent>
          {emailConsent.reason ? `Motivo: ${emailConsent.reason}` : "Consentimento bloqueado para e-mail"}
        </TooltipContent>
      </Tooltip>
    )
  }
  if (emailConsent?.status === "allowed" && profile.primaryEmail) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge className="border-semantic-success-border bg-semantic-success-surface text-semantic-success">
            Apto
          </Badge>
        </TooltipTrigger>
        <TooltipContent>Elegível para campanhas de e-mail</TooltipContent>
      </Tooltip>
    )
  }
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Badge variant="secondary">Indefinido</Badge>
      </TooltipTrigger>
      <TooltipContent>Sem consentimento de e-mail registrado</TooltipContent>
    </Tooltip>
  )
}

export function WhatsappBadge({ profile }: { profile: RadarProfileListItem }) {
  const whatsappConsent = profile.consents.find((c) => c.channel === "whatsapp")
  if (!whatsappConsent) {
    return <Badge variant="outline">WhatsApp: Indefinido</Badge>
  }
  if (whatsappConsent.status === "blocked") {
    return <Badge variant="destructive">WhatsApp: Bloqueado</Badge>
  }
  return <Badge variant="secondary">WhatsApp: Apto</Badge>
}

export function SourceBadges({ profile }: { profile: RadarProfileListItem }) {
  const types = [...new Set(profile.sourceLinks.map((l) => l.sourceType))]
  return (
    <>
      {types.map((type) => (
        <Badge key={type} variant="outline" className="text-xs">
          {type.replace("_", " ")}
        </Badge>
      ))}
    </>
  )
}
