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
      managerName: await this.resolveTeamMasterName(profileId),
    }
  }

  /**
   * `managerName` no e-mail de acesso do backoffice é "quem convidou" — o MASTER do
   * time (mesma semântica de `BackofficePlatformUsersUseCase.getMasterUserDetails`),
   * não `profile.managerId` (reporte direto operador→manager dentro do time, fica
   * `null` para quem foi convidado direto pelo master — o caso mais comum). Usar
   * `profile.managerId` aqui era o motivo do assunto do e-mail cair no fallback
   * genérico "Equipe Corretor Studio" no reenvio (bug 2026-08-27).
   */
  private async resolveTeamMasterName(profileId: string): Promise<string | null> {
    const membership = await prisma.teamMember.findFirst({
      where: { profileId },
      select: {
        team: {
          select: {
            master: {
              select: { fullName: true, email: true },
            },
          },
        },
      },
      orderBy: { createdAt: "asc" },
    })

    if (!membership) {
      return null
    }

    return membership.team.master.fullName ?? membership.team.master.email ?? null
  }
}
