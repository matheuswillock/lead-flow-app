"use client"

import type { LeadStatus } from "@prisma/client"

export const leadStatusLabels: Record<LeadStatus, string> = {
  new_opportunity: "Nova oportunidade",
  scheduled: "Agendado",
  no_show: "No Show",
  pricingRequest: "Cotacao",
  future_sale: "Venda Futura",
  offerNegotiation: "Negociacao",
  pending_documents: "Documentos pendentes",
  offerSubmission: "Proposta enviada",
  dps_agreement: "DPS | Contrato",
  invoicePayment: "Boleto",
  disqualified: "Desqualificado",
  opportunityLost: "Perdido",
  operator_denied: "Negado operadora",
  contract_finalized: "Negocio fechado",
}

export const getLeadStatusLabel = (status: LeadStatus | string) =>
  leadStatusLabels[status as LeadStatus] ?? status

export const isDraftLead = (lead: { status: LeadStatus | null | undefined }) =>
  lead.status === null || lead.status === undefined

export const getLeadStatusBadgeClass = (status: string) => {
  const classes: Record<string, string> = {
    new_opportunity: "border-primary/30 bg-primary/10 text-primary",
    scheduled: "border-semantic-warning-border bg-semantic-warning-surface text-semantic-warning",
    no_show: "border-border bg-muted text-muted-foreground",
    pricingRequest: "border-semantic-info-border bg-semantic-info-surface text-semantic-info",
    future_sale: "border-primary/30 bg-primary/10 text-primary",
    offerNegotiation: "border-semantic-info-border bg-semantic-info-surface text-semantic-info",
    pending_documents: "border-semantic-info-border bg-semantic-info-surface text-semantic-info",
    offerSubmission: "border-semantic-info-border bg-semantic-info-surface text-semantic-info",
    dps_agreement: "border-semantic-info-border bg-semantic-info-surface text-semantic-info",
    invoicePayment: "border-semantic-info-border bg-semantic-info-surface text-semantic-info",
    disqualified: "border-semantic-danger-border bg-semantic-danger-surface text-semantic-danger",
    opportunityLost: "border-semantic-danger-border bg-semantic-danger-surface text-semantic-danger",
    operator_denied: "border-semantic-danger-border bg-semantic-danger-surface text-semantic-danger",
    contract_finalized: "border-semantic-success-border bg-semantic-success-surface text-semantic-success",
  }

  return classes[status] ?? "border-border bg-muted text-muted-foreground"
}
