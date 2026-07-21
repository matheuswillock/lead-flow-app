export type RadarFieldSourceType = "PROFILE" | "CRM" | "PORTFOLIO" | "EMAIL"

export type RadarFieldCatalogEntry = {
  key: string
  label: string
  sourceType: RadarFieldSourceType
  path: string
  valueType: "string" | "number" | "date"
  description?: string
}

export const RADAR_FIELD_CATALOG: RadarFieldCatalogEntry[] = [
  {
    key: "profile.displayName",
    label: "Nome do perfil",
    sourceType: "PROFILE",
    path: "displayName",
    valueType: "string",
  },
  {
    key: "profile.primaryEmail",
    label: "E-mail principal",
    sourceType: "PROFILE",
    path: "primaryEmail",
    valueType: "string",
  },
  {
    key: "profile.displayPhone",
    label: "Telefone",
    sourceType: "PROFILE",
    path: "displayPhone",
    valueType: "string",
  },
  {
    key: "profile.primaryDocument",
    label: "Documento",
    sourceType: "PROFILE",
    path: "primaryDocument",
    valueType: "string",
  },
  {
    key: "profile.lastSeenAt",
    label: "Última interação",
    sourceType: "PROFILE",
    path: "lastSeenAt",
    valueType: "date",
  },
  {
    key: "crm.lead.status",
    label: "Status do lead",
    sourceType: "CRM",
    path: "status",
    valueType: "string",
  },
  {
    key: "crm.lead.currentHealthPlan",
    label: "Plano atual",
    sourceType: "CRM",
    path: "currentHealthPlan",
    valueType: "string",
  },
  {
    key: "crm.lead.soldPlan",
    label: "Plano vendido",
    sourceType: "CRM",
    path: "soldPlan",
    valueType: "string",
  },
  {
    key: "crm.lead.contractDueDate",
    label: "Vigência do contrato",
    sourceType: "CRM",
    path: "contractDueDate",
    valueType: "date",
  },
  {
    key: "crm.lead.referenceHospital",
    label: "Hospital de referência",
    sourceType: "CRM",
    path: "referenceHospital",
    valueType: "string",
  },
  {
    key: "portfolio.renewalStatus",
    label: "Status de renovação",
    sourceType: "PORTFOLIO",
    path: "renewalStatus",
    valueType: "string",
  },
  {
    key: "portfolio.portfolioStatus",
    label: "Status da carteira",
    sourceType: "PORTFOLIO",
    path: "portfolioStatus",
    valueType: "string",
  },
  {
    key: "portfolio.renewalAmount",
    label: "Valor de renovação",
    sourceType: "PORTFOLIO",
    path: "renewalAmount",
    valueType: "number",
  },
  {
    key: "email.consentStatus",
    label: "Consentimento de e-mail",
    sourceType: "EMAIL",
    path: "consentStatus",
    valueType: "string",
  },
]

const catalogByKey = new Map(RADAR_FIELD_CATALOG.map((entry) => [entry.key, entry]))

export function getRadarFieldCatalogEntry(key: string): RadarFieldCatalogEntry | undefined {
  return catalogByKey.get(key)
}

export function isValidRadarFieldKey(key: string): boolean {
  return catalogByKey.has(key)
}

export function listRadarFieldCatalog(): RadarFieldCatalogEntry[] {
  return [...RADAR_FIELD_CATALOG]
}

export const RADAR_PRIMARY_SEGMENT_PRIORITY = [
  "email_blocked",
  "portfolio_renewal_due",
  "clicked_not_closed",
  "opened_not_clicked",
  "email_marketable",
  "inactive_recent_campaign",
] as const
