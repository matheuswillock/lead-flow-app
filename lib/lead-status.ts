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

// Tokens --stage-* definidos em DESIGN.md (TOKENS:LIGHT) — paleta "Etapas do
// pipeline" do UI Kit.
const leadStatusStageColors: Record<LeadStatus, string> = {
  new_opportunity: "var(--stage-new-opportunity)",
  scheduled: "var(--stage-scheduled)",
  no_show: "var(--stage-no-show)",
  pricingRequest: "var(--stage-pricing-request)",
  future_sale: "var(--stage-future-sale)",
  offerNegotiation: "var(--stage-offer-negotiation)",
  pending_documents: "var(--stage-pending-documents)",
  offerSubmission: "var(--stage-offer-submission)",
  dps_agreement: "var(--stage-dps-agreement)",
  invoicePayment: "var(--stage-invoice-payment)",
  disqualified: "var(--stage-disqualified)",
  opportunityLost: "var(--stage-opportunity-lost)",
  operator_denied: "var(--stage-operator-denied)",
  contract_finalized: "var(--stage-contract-finalized)",
}

export const getLeadStatusStageColor = (status: LeadStatus | string) =>
  leadStatusStageColors[status as LeadStatus] ?? "var(--muted-foreground)"
