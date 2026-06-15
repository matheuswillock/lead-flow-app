export type LeadImportStatusKey =
  | "new_opportunity"
  | "scheduled"
  | "no_show"
  | "pricingRequest"
  | "future_sale"
  | "offerNegotiation"
  | "pending_documents"
  | "offerSubmission"
  | "dps_agreement"
  | "invoicePayment"
  | "disqualified"
  | "opportunityLost"
  | "operator_denied"
  | "contract_finalized";

export interface LeadImportStatusOption {
  value: LeadImportStatusKey;
  label: string;
}

/** Status do funil do Corretor Studio, na mesma ordem das colunas do board. */
export const LEAD_IMPORT_STATUS_OPTIONS: LeadImportStatusOption[] = [
  { value: "new_opportunity", label: "Nova oportunidade" },
  { value: "scheduled", label: "Agendado" },
  { value: "no_show", label: "No Show" },
  { value: "pricingRequest", label: "Cotação" },
  { value: "future_sale", label: "Venda Futura" },
  { value: "offerNegotiation", label: "Negociação" },
  { value: "pending_documents", label: "Documentos pendentes" },
  { value: "offerSubmission", label: "Proposta" },
  { value: "dps_agreement", label: "DPS | Contrato" },
  { value: "invoicePayment", label: "Boleto" },
  { value: "disqualified", label: "Desqualificado" },
  { value: "opportunityLost", label: "Perdido" },
  { value: "operator_denied", label: "Negado operadora" },
  { value: "contract_finalized", label: "Negócio fechado" },
];

const STATUS_LABEL_BY_KEY = new Map(
  LEAD_IMPORT_STATUS_OPTIONS.map((option) => [option.value, option.label])
);

export const getLeadImportStatusLabel = (key: LeadImportStatusKey): string =>
  STATUS_LABEL_BY_KEY.get(key) ?? key;

const STATUS_KEYS = new Set<string>(LEAD_IMPORT_STATUS_OPTIONS.map((option) => option.value));

export const isLeadImportStatusKey = (value: string): value is LeadImportStatusKey =>
  STATUS_KEYS.has(value);

const normalize = (value: string) =>
  value
    .toString()
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

/**
 * Sugere um status do funil a partir de um texto livre (ex.: valores vindos de
 * planilhas em português). Valores que já são uma chave interna de status são
 * devolvidos como estão. Sem correspondência, o padrão é "new_opportunity".
 */
export const suggestLeadStatus = (value: string | null | undefined): LeadImportStatusKey => {
  if (!value) return "new_opportunity";
  const trimmed = value.trim();
  if (isLeadImportStatusKey(trimmed)) return trimmed;

  const normalized = normalize(trimmed);

  if (normalized === "contract_finalized" || normalized === "contract finalized") {
    return "contract_finalized";
  }
  if (normalized === "agendado") return "scheduled";
  if (normalized === "negociacao") return "offerNegotiation";
  if (normalized === "pendente") return "pending_documents";
  if (normalized === "doctos pendentes") return "pending_documents";
  if (normalized === "implementacao enviada") return "offerSubmission";
  if (normalized === "venda futura") return "future_sale";

  if (normalized.includes("perdido")) return "opportunityLost";
  if (normalized.includes("desqualificado")) return "disqualified";
  if (normalized.includes("negado")) return "operator_denied";
  if (normalized.includes("no show")) return "no_show";
  if (normalized.includes("agend")) return "scheduled";
  if (normalized.includes("cotacao")) return "pricingRequest";
  if (normalized.includes("negoci")) return "offerNegotiation";
  if (normalized.includes("document")) return "pending_documents";
  if (normalized.includes("proposta")) return "offerSubmission";
  if (
    normalized.includes("negocio fechado") ||
    (normalized.includes("negocio") && normalized.includes("fechado")) ||
    normalized.includes("contrato assinado") ||
    normalized.includes("contrato fechado") ||
    normalized.includes("venda concluida") ||
    normalized.includes("fechado") ||
    normalized.includes("finalizado")
  ) {
    return "contract_finalized";
  }
  if (normalized.includes("dps") || normalized.includes("contrato")) return "dps_agreement";
  if (normalized.includes("boleto") || normalized.includes("fatura")) return "invoicePayment";

  return "new_opportunity";
};
