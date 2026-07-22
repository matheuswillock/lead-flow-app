export interface BackofficeAccountData {
  profileId: string
  supabaseId: string | null
  backofficeUserId: string
  fullName: string | null
  email: string
  phone: string | null
  cpfCnpj: string | null
  postalCode: string | null
  address: string | null
  addressNumber: string | null
  neighborhood: string | null
  complement: string | null
  city: string | null
  state: string | null
  profileIconId: string | null
  profileIconUrl: string | null
  fullAccess: boolean
  isActive: boolean
  isSdr: boolean
  isCloser: boolean
  googleCalendarConnected: boolean
  googleEmail: string | null
  googleConnectionSource: "backoffice_user" | "linked_profile" | null
  timezone: string
}

export interface BackofficeGoogleScopesResult {
  connected: boolean
  scopes: string[]
}

export interface BackofficeAccountUpdateInput {
  fullName?: string
  email?: string
  phone?: string
  cpfCnpj?: string
  postalCode?: string
  address?: string
  addressNumber?: string
  neighborhood?: string
  complement?: string
  city?: string
  state?: string
}
