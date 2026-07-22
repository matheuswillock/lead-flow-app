import { Output } from "@/lib/output"
import { BackofficeUserRepository } from "@/app/api/infra/data/repositories/backoffice/UserRepository/BackofficeUserRepository"
import type { IBackofficeUserRepository } from "@/app/api/infra/data/repositories/backoffice/UserRepository/IBackofficeUserRepository"
import type { IBackofficeGoogleConnectionResolverService } from "@/app/api/services/Backoffice/backofficeGoogleConnection/IBackofficeGoogleConnectionResolverService"
import { backofficeGoogleConnectionResolverService } from "@/app/api/services/Backoffice/backofficeGoogleConnection/BackofficeGoogleConnectionResolverService"

export interface IBackofficePublicLeadFormBootstrapUseCase {
  listClosers(): Promise<Output>
}

export class BackofficePublicLeadFormBootstrapUseCase
  implements IBackofficePublicLeadFormBootstrapUseCase
{
  constructor(
    private readonly userRepo: IBackofficeUserRepository,
    private readonly googleResolver: IBackofficeGoogleConnectionResolverService
  ) {}

  async listClosers(): Promise<Output> {
    try {
      const users = await this.userRepo.findMany({ isActive: true })
      const closers = users.filter((user) => user.isCloser)

      const options = (
        await Promise.all(
          closers.map(async (closer) => {
            const organizer = await this.googleResolver.resolveForBackofficeUser(closer.id)
            if (!organizer) return null
            return {
              id: closer.id,
              name: closer.profile.fullName || closer.email,
              timezone: closer.timezone,
              googleCalendarConnected: true as const,
            }
          })
        )
      ).filter((option): option is NonNullable<typeof option> => option !== null)

      return new Output(true, [], [], { closers: options })
    } catch (error) {
      console.error("[BackofficePublicLeadFormBootstrapUseCase][listClosers]", error)
      return new Output(false, [], ["Erro ao listar closers disponíveis"], null)
    }
  }
}

export const backofficePublicLeadFormBootstrapUseCase =
  new BackofficePublicLeadFormBootstrapUseCase(
    new BackofficeUserRepository(),
    backofficeGoogleConnectionResolverService
  )
