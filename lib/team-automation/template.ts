import type { LeadStatus } from "@prisma/client";

const LEAD_STATUS_LABELS: Partial<Record<LeadStatus, string>> = {
  new_opportunity: "Nova Oportunidade",
  scheduled: "Agendado",
  no_show: "No Show",
  pricingRequest: "Cotação",
  future_sale: "Venda Futura",
  offerNegotiation: "Negociação",
  pending_documents: "Documentos pendentes",
  offerSubmission: "Proposta",
  dps_agreement: "DPS | Contrato",
  invoicePayment: "Boleto",
  disqualified: "Desqualificado",
  opportunityLost: "Perdido",
  operator_denied: "Negado operadora",
  contract_finalized: "Negócio fechado",
};

type LeadTemplateContext = {
  name: string;
  status: LeadStatus | null;
  leadCode?: string | null;
  email?: string | null;
  phone?: string | null;
};

export function interpolateAutomationTemplate(
  template: string,
  lead: LeadTemplateContext
): string {
  const statusLabel = lead.status ? (LEAD_STATUS_LABELS[lead.status] ?? lead.status) : "";
  return template
    .replace(/\{\{lead\.name\}\}/g, lead.name)
    .replace(/\{\{lead\.status\}\}/g, statusLabel)
    .replace(/\{\{lead\.leadCode\}\}/g, lead.leadCode ?? "")
    .replace(/\{\{lead\.email\}\}/g, lead.email ?? "")
    .replace(/\{\{lead\.phone\}\}/g, lead.phone ?? "");
}

export function sanitizeRunLogPayload(payload: Record<string, unknown>): Record<string, unknown> {
  const sanitized: Record<string, unknown> = {};
  const allowedKeys = ["actionType", "triggerType", "leadName", "leadCode", "recipientCount"];
  for (const key of allowedKeys) {
    if (key in payload) sanitized[key] = payload[key];
  }
  return sanitized;
}
