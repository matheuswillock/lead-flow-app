import type { BackofficeUser } from "@prisma/client"
import { prisma } from "@/app/api/infra/data/prisma"
import type {
  IBackofficeUserRepository,
  CreateBackofficeUserInput,
  UpdateBackofficeUserInput,
  BackofficeUserWithProfile,
} from "./IBackofficeUserRepository"

export class BackofficeUserRepository implements IBackofficeUserRepository {
  async create(data: CreateBackofficeUserInput): Promise<BackofficeUser> {
    return prisma.backofficeUser.create({
      data: {
        id: data.id,
        profileId: data.profileId,
        email: data.email,
        fullAccess: data.fullAccess ?? false,
        isSdr: data.isSdr ?? true,
        isCloser: data.isCloser ?? true,
        createdByProfileId: data.createdByProfileId,
      },
    })
  }

  async findMany(params?: { isActive?: boolean }): Promise<BackofficeUserWithProfile[]> {
    return prisma.backofficeUser.findMany({
      where: params?.isActive !== undefined ? { isActive: params.isActive } : undefined,
      include: {
        profile: {
          select: { fullName: true, email: true },
        },
      },
      orderBy: { createdAt: "desc" },
    })
  }

  async findById(id: string): Promise<BackofficeUser | null> {
    return prisma.backofficeUser.findUnique({ where: { id } })
  }

  async findByEmail(email: string): Promise<BackofficeUser | null> {
    return prisma.backofficeUser.findUnique({ where: { email } })
  }

  async findByProfileId(profileId: string): Promise<BackofficeUser | null> {
    return prisma.backofficeUser.findUnique({ where: { profileId } })
  }

  async update(id: string, data: UpdateBackofficeUserInput): Promise<BackofficeUser> {
    return prisma.backofficeUser.update({
      where: { id },
      data: {
        ...(data.email !== undefined ? { email: data.email } : {}),
        ...(data.isActive !== undefined ? { isActive: data.isActive } : {}),
        ...(data.fullAccess !== undefined ? { fullAccess: data.fullAccess } : {}),
        ...(data.isSdr !== undefined ? { isSdr: data.isSdr } : {}),
        ...(data.isCloser !== undefined ? { isCloser: data.isCloser } : {}),
        ...(data.googleCalendarConnected !== undefined
          ? { googleCalendarConnected: data.googleCalendarConnected }
          : {}),
        ...(data.googleAccessToken !== undefined
          ? { googleAccessToken: data.googleAccessToken }
          : {}),
        ...(data.googleRefreshToken !== undefined
          ? { googleRefreshToken: data.googleRefreshToken }
          : {}),
        ...(data.googleTokenExpiresAt !== undefined
          ? { googleTokenExpiresAt: data.googleTokenExpiresAt }
          : {}),
        ...(data.googleEmail !== undefined ? { googleEmail: data.googleEmail } : {}),
        ...(data.timezone !== undefined ? { timezone: data.timezone } : {}),
        ...(data.mailboxStatus !== undefined ? { mailboxStatus: data.mailboxStatus } : {}),
        ...(data.mailboxAddress !== undefined ? { mailboxAddress: data.mailboxAddress } : {}),
        ...(data.mailboxProvisionedAt !== undefined
          ? { mailboxProvisionedAt: data.mailboxProvisionedAt }
          : {}),
      },
    })
  }
}
