import { prisma } from "../../prisma";
import type {
  IPublicLeadFormRepository,
  PublicLeadFormMemberRecord,
  PublicLeadFormTeamAccessRecord,
} from "./IPublicLeadFormRepository";

export class PublicLeadFormRepository implements IPublicLeadFormRepository {
  async hasTransferRoutes(teamId: string): Promise<boolean> {
    return (await prisma.teamTransferRoute.count({ where: { sourceTeamId: teamId } })) > 0;
  }

  async findMemberFunctions(teamId: string, profileId: string) {
    const member = await prisma.teamMember.findUnique({
      where: { teamId_profileId: { teamId, profileId } },
      select: { functions: true },
    });
    return member?.functions ?? null;
  }

  findTeamAccess(teamId: string): Promise<PublicLeadFormTeamAccessRecord | null> {
    return prisma.team.findUnique({
      where: { id: teamId },
      select: {
        id: true,
        name: true,
        masterId: true,
        master: { select: { id: true, supabaseId: true, timezone: true } },
      },
    });
  }

  findProfileBySupabaseId(supabaseId: string): Promise<{ id: string } | null> {
    return prisma.profile.findUnique({ where: { supabaseId }, select: { id: true } });
  }

  async isTeamMember(teamId: string, profileId: string): Promise<boolean> {
    const member = await prisma.teamMember.findUnique({
      where: { teamId_profileId: { teamId, profileId } },
      select: { id: true },
    });
    return member !== null;
  }

  listTeamMembers(teamId: string): Promise<PublicLeadFormMemberRecord[]> {
    return prisma.teamMember.findMany({
      where: { teamId },
      select: {
        profileId: true,
        functions: true,
        profile: { select: { id: true, fullName: true, email: true, profileIconUrl: true } },
      },
    });
  }

  async findProfileEmail(profileId: string): Promise<string | null> {
    const profile = await prisma.profile.findUnique({ where: { id: profileId }, select: { email: true } });
    return profile?.email ?? null;
  }
}

export const publicLeadFormRepository = new PublicLeadFormRepository();
