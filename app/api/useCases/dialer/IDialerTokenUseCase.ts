import type { Output } from "@/lib/output"

export type DialerTokenResult = {
  token: string
  identity: string
}

export interface IDialerTokenUseCase {
  generateToken(teamId: string, profileId: string): Promise<Output>
}
