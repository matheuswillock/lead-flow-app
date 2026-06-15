import { prisma } from "@/app/api/infra/data/prisma"
import type {
  BackofficeMemberAccessProfileRecord,
  IBackofficeMemberAccessRepository,
} from "./IBackofficeMemberAccessRepository"

export class BackofficeMemberAccessRepository implements IBackofficeMemberAccessRepository {
  async findProfileAccessRecord(profileId: string): Promise<BackofficeMemberAccessProfileRecord | null> {
    const profile = await prisma.profile.findUnique({
      where: { id: profileId },
      select: {
        id: true,
        supabaseId: true,
        email: true,
        fullName: true,
        role: true,
        isMaster: true,
        manager: {
          select: {
            fullName: true,
            email: true,
          },
        },
      },
    })

    if (!profile) {
      return null
    }

    return {
      profileId: profile.id,
      supabaseId: profile.supabaseId,
      email: profile.email,
      fullName: profile.fullName,
      role: profile.role,
      isMaster: profile.isMaster,
      managerName: profile.manager?.fullName ?? profile.manager?.email ?? null,
    }
  }
}
