import type { Output } from "@/lib/output"
import type { BackofficeMemberAccessMode } from "@/lib/backoffice-member-access"

export interface IBackofficeMemberAccessEmailUseCase {
  sendAccessEmail(profileId: string, mode: BackofficeMemberAccessMode): Promise<Output>
  generateInviteLink(profileId: string): Promise<Output>
}
