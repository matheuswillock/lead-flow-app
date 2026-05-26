import { prisma } from "@/app/api/infra/data/prisma"
import type {
  CreateGoogleOAuthConnectionInput,
  IGoogleOAuthConnectionRepository,
  UpdateGoogleOAuthTokensInput,
} from "./IGoogleOAuthConnectionRepository"

export class GoogleOAuthConnectionRepository implements IGoogleOAuthConnectionRepository {
  async findById(id: string) {
    return prisma.googleOAuthConnection.findUnique({ where: { id } })
  }

  async findByGoogleEmail(googleEmail: string) {
    return prisma.googleOAuthConnection.findUnique({ where: { googleEmail } })
  }

  async create(input: CreateGoogleOAuthConnectionInput) {
    return prisma.googleOAuthConnection.create({
      data: {
        googleEmail: input.googleEmail,
        accessToken: input.accessToken ?? null,
        refreshToken: input.refreshToken ?? null,
        tokenExpiresAt: input.tokenExpiresAt ?? null,
        ownerProfileId: input.ownerProfileId ?? null,
      },
    })
  }

  async updateTokens(id: string, input: UpdateGoogleOAuthTokensInput) {
    return prisma.googleOAuthConnection.update({
      where: { id },
      data: {
        accessToken: input.accessToken,
        refreshToken: input.refreshToken,
        tokenExpiresAt: input.tokenExpiresAt,
        lastRefreshedAt: input.lastRefreshedAt,
        lastRefreshError: input.lastRefreshError,
      },
    })
  }

  async markRevoked(id: string, reason?: string | null) {
    return prisma.googleOAuthConnection.update({
      where: { id },
      data: {
        revokedAt: new Date(),
        lastRefreshError: reason ?? null,
      },
    })
  }

  async attachToProfile(connectionId: string, profileId: string) {
    return prisma.googleOAuthConnection.update({
      where: { id: connectionId },
      data: { ownerProfileId: profileId },
    })
  }

  async attachToBackofficeUser(connectionId: string, backofficeUserId: string) {
    await prisma.backofficeUser.update({
      where: { id: backofficeUserId },
      data: { googleConnectionId: connectionId },
    })
  }

  async detachFromProfile(profileId: string) {
    await prisma.profile.update({
      where: { id: profileId },
      data: { googleConnectionId: null },
    })
  }

  async detachFromBackofficeUser(backofficeUserId: string) {
    await prisma.backofficeUser.update({
      where: { id: backofficeUserId },
      data: { googleConnectionId: null },
    })
  }
}

export const googleOAuthConnectionRepository = new GoogleOAuthConnectionRepository()
