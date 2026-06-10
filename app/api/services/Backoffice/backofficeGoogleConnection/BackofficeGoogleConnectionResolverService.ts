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

  async resolveForBackofficeUsers(
    backofficeUserIds: string[]
  ): Promise<Map<string, ResolvedBackofficeGoogleOrganizer>> {
    const users = await this.backofficeUserRepo.findManyByIdsWithGoogleContext(backofficeUserIds)
    const organizers = new Map<string, ResolvedBackofficeGoogleOrganizer>()

    for (const user of users) {
      const resolved = resolveBackofficeGoogleConnection(user)
      if (!resolved) continue

      organizers.set(user.id, {
        connection: resolved.connection,
        source: resolved.source,
        backofficeUserId: user.id,
        backofficeUserEmail: user.email,
        timezone: user.timezone,
        ownerProfileId: resolved.connection.ownerProfileId,
      })
    }

    return organizers
  }
}

export const backofficeGoogleConnectionResolverService =
  new BackofficeGoogleConnectionResolverService(new BackofficeUserRepository())
