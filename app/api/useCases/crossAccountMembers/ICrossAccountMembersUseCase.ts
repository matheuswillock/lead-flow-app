import { Output } from "@/lib/output";

export interface InviteExternalMemberInput {
  email: string;
  role: "manager" | "backoffice" | "operator";
  functions: ("SDR" | "CLOSER")[];
  canCreateAccountUsers?: boolean;
  canManageAccountTeams?: boolean;
  canTransferAccountLeads?: boolean;
}

export interface ICrossAccountMembersUseCase {
  lookupProfileByEmail(
    supabaseId: string,
    teamId: string,
    email: string
  ): Promise<Output>;
  inviteExternalMember(
    supabaseId: string,
    teamId: string,
    data: InviteExternalMemberInput
  ): Promise<Output>;
}
