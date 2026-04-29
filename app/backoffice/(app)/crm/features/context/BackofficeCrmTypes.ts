export type BackofficeLeadStatusKey =
  | "new_opportunity"
  | "scheduled"
  | "no_show"
  | "lost"
  | "implementation"
  | "finalized"

export interface BackofficeLeadItem {
  id: string
  name: string
  email: string | null
  phone: string | null
  notes: string | null
  status: BackofficeLeadStatusKey
  statusEnteredAt: string
  createdAt: string
  updatedAt: string
}

export interface BackofficeLeadCreateInput {
  name: string
  email?: string | null
  phone?: string | null
  notes?: string | null
  status?: BackofficeLeadStatusKey
}

export interface BackofficeLeadUpdateInput {
  name?: string
  email?: string | null
  phone?: string | null
  notes?: string | null
}

export const BACKOFFICE_CRM_COLUMNS: { key: BackofficeLeadStatusKey; title: string }[] = [
  { key: "new_opportunity", title: "Nova oportunidade" },
  { key: "scheduled", title: "Agendado" },
  { key: "no_show", title: "No-show" },
  { key: "lost", title: "Perdido" },
  { key: "implementation", title: "Implementação" },
  { key: "finalized", title: "Finalizado" },
]
