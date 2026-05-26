import type { IBackofficeUserRepository } from "@/app/api/infra/data/repositories/backoffice/UserRepository/IBackofficeUserRepository"
import { BackofficeUserRepository } from "@/app/api/infra/data/repositories/backoffice/UserRepository/BackofficeUserRepository"
import { resolveBackofficeGoogleConnection } from "@/lib/google/connection"
import type {
  IBackofficeGoogleConnectionResolverService,
  ResolvedBackofficeGoogleOrganizer,
} from "./IBackofficeGoogleConnectionResolverService"

export class BackofficeGoogleConnectionResolverService
  implements IBackofficeGoogleConnectionResolverService
{
  constructor(private readonly backofficeUserRepo: IBackofficeUserRepository) {}

  async resolveForBackofficeUser(
    backofficeUserId: string
  ): Promise<ResolvedBackofficeGoogleOrganizer | null> {
    const user = await this.backofficeUserRepo.findByIdWithGoogleContext(backofficeUserId)

    if (!user) return null

    const resolved = resolveBackofficeGoogleConnection(user)
    if (!resolved) return null

    return {
      connection: resolved.connection,
      source: resolved.source,
      backofficeUserId: user.id,
      backofficeUserEmail: user.email,
      timezone: user.timezone,
      ownerProfileId: resolved.connection.ownerProfileId,
    }
  }
}

export const backofficeGoogleConnectionResolverService =
  new BackofficeGoogleConnectionResolverService(new BackofficeUserRepository())
