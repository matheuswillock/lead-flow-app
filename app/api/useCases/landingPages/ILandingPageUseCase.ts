import type { TeamAccess } from "@/app/api/v1/utils/teamAccess"
import { Output } from "@/lib/output"
import type { LandingPageDraftInput } from "@/lib/landing-pages/types"

export interface ILandingPageUseCase {
  list(access: TeamAccess): Promise<Output>
  get(access: TeamAccess, id: string): Promise<Output>
  create(access: TeamAccess, input: LandingPageDraftInput): Promise<Output>
  update(access: TeamAccess, id: string, input: LandingPageDraftInput): Promise<Output>
  publish(access: TeamAccess, id: string): Promise<Output>
  archive(access: TeamAccess, id: string): Promise<Output>
  getPublic(publicId: string): Promise<Output>
}
