"use client"

import type { LeadStatus } from "@prisma/client"

export const leadStatusLabels: Record<LeadStatus, string> = {
  new_opportunity: "Nova oportunidade",
  scheduled: "Agendado",
  no_show: "No Show",
  pricingRequest: "Cotacao",
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
