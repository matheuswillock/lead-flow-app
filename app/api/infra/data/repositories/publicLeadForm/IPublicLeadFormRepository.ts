import type { UserFunction } from "@prisma/client";

export type PublicLeadFormTeamAccessRecord = {
  id: string;
  name: string;
  masterId: string;
  master: { id: string; supabaseId: string | null; timezone: string | null };
};

export type PublicLeadFormMemberRecord = {
  profileId: string;
  functions: UserFunction[];
  profile: {
    id: string;
    fullName: string | null;
    email: string | null;
    profileIconUrl: string | null;
  };
};

export interface IPublicLeadFormRepository {
  hasTransferRoutes(teamId: string): Promise<boolean>;
  findMemberFunctions(teamId: string, profileId: string): Promise<UserFunction[] | null>;
  findTeamAccess(teamId: string): Promise<PublicLeadFormTeamAccessRecord | null>;
  findProfileBySupabaseId(supabaseId: string): Promise<{ id: string } | null>;
  isTeamMember(teamId: string, profileId: string): Promise<boolean>;
  listTeamMembers(teamId: string): Promise<PublicLeadFormMemberRecord[]>;
  findProfileEmail(profileId: string): Promise<string | null>;
}
