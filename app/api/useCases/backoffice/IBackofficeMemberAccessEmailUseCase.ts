import type { Output } from "@/lib/output"
import type { BackofficeMemberAccessMode } from "@/lib/backoffice-member-access"

export interface IBackofficeMemberAccessEmailUseCase {
  sendAccessEmail(input: {
    profileId: string
    accountMasterId: string
    mode: BackofficeMemberAccessMode
  }): Promise<Output>
  generateInviteLink(input: { profileId: string; accountMasterId: string }): Promise<Output>
}
