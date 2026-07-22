import type { Output } from "@/lib/output"

export interface UpdateBackofficeAccountDTO {
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

export interface UpdateBackofficeGoogleConnectionDTO {
  accessToken: string
  refreshToken?: string | null
  expiresAt?: string | null
  email?: string | null
}

export interface IBackofficeAccountUseCase {
  getAccount(profileId: string): Promise<Output>
  updateAccount(profileId: string, data: UpdateBackofficeAccountDTO): Promise<Output>
  updatePassword(supabaseId: string, password: string): Promise<Output>
  updateTimezone(profileId: string, timezone: string): Promise<Output>
  connectGoogle(profileId: string, data: UpdateBackofficeGoogleConnectionDTO): Promise<Output>
  disconnectGoogle(profileId: string): Promise<Output>
  getGoogleScopes(profileId: string): Promise<Output>
}
