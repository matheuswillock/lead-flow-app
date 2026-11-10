import { prisma } from "@/app/api/infra/data/prisma"
import { STORAGE_BUCKETS } from "@/lib/supabase/storage"
import type {
  ITeamDeletionSnapshotSource,
  TeamDeletionSnapshot,
  TeamStorageItem,
} from "@/app/api/shared/teamDeletion/teamDeletionTypes"

/** Foto do time antes da exclusão definitiva: quem são os membros, o tamanho do que será apagado e os arquivos. */
export class TeamDeletionSnapshotRepository implements ITeamDeletionSnapshotSource {
  async snapshot(teamId: string): Promise<TeamDeletionSnapshot> {
    const [members, leadCount, attachments, contracts] = await Promise.all([
      prisma.teamMember.findMany({ where: { teamId }, select: { profileId: true } }),
      prisma.lead.count({ where: { teamId } }),
      prisma.leadAttachment.findMany({
        where: { lead: { teamId } },
        select: { storagePath: true },
      }),
      prisma.leadFinalized.findMany({
        where: { lead: { teamId }, contractStoragePath: { not: null } },
        select: { contractStoragePath: true },
      }),
    ])

    // Anexos e contratos de lead usam o mesmo bucket (o contrato sobe pela rota de anexos).
    const bucket = STORAGE_BUCKETS.LEAD_ATTACHMENTS
    const paths = new Set<string>()
    for (const item of attachments) if (item.storagePath) paths.add(item.storagePath)
    for (const item of contracts) if (item.contractStoragePath) paths.add(item.contractStoragePath)
    const storagePaths: TeamStorageItem[] = Array.from(paths).map((path) => ({ bucket, path }))

    return {
      memberProfileIds: members.map((member) => member.profileId),
      memberCount: members.length,
      leadCount,
      storagePaths,
    }
  }

  async findDetails(
    requesterProfileId: string,
    teamId: string,
  ): Promise<{ requesterName: string; teamName: string }> {
    const [profile, team] = await Promise.all([
      prisma.profile.findUnique({ where: { id: requesterProfileId }, select: { fullName: true, email: true } }),
      prisma.team.findUnique({ where: { id: teamId }, select: { name: true } }),
    ])
    return {
      requesterName: profile?.fullName || profile?.email || "Usuário",
      teamName: team?.name || "Time",
    }
  }

  async findProfileIdBySupabaseId(supabaseId: string): Promise<string | null> {
    const profile = await prisma.profile.findUnique({ where: { supabaseId }, select: { id: true } })
    return profile?.id ?? null
  }

  /** Outro time do usuário (que continua existindo): onde a notificação da exportação fica guardada. */
  async findAnotherTeamId(profileId: string, excludeTeamId: string): Promise<string | null> {
    const membership = await prisma.teamMember.findFirst({
      where: { profileId, teamId: { not: excludeTeamId }, team: { deletedAt: null } },
      select: { teamId: true },
      orderBy: { teamId: "asc" },
    })
    return membership?.teamId ?? null
  }
}

export const teamDeletionSnapshotRepository = new TeamDeletionSnapshotRepository()
