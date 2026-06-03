import type { EmailSettings } from "@/app/[supabaseId]/email/configuracoes/features/context/EmailSettingsTypes"

export type { EmailSettings }

export type BackofficeTeamEmailEntry = {
  teamId: string
  teamName: string
  masterEmail: string | null
  settings: EmailSettings | null
}

export type BackofficeEmailSettingsListResult = {
  items: BackofficeTeamEmailEntry[]
  total: number
  page: number
  totalPages: number
}
