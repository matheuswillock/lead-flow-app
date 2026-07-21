import type { UserFunction, UserRole } from "@prisma/client";
import { isManagerLikeRole } from "@/lib/roles";

export type BotPolicyTeamMember = {
  role: UserRole;
  functions: UserFunction[];
};

export type BotPolicyAccessLike = {
  isMaster: boolean;
  canTransferAccountLeads: boolean;
  profileId: string;
  teamMember: BotPolicyTeamMember;
};

export function isManagerOrMasterAccess(access: BotPolicyAccessLike): boolean {
  return access.isMaster || isManagerLikeRole(access.teamMember.role);
}

export function hasLeadAccess(teamMember: BotPolicyTeamMember): boolean {
  if (isManagerLikeRole(teamMember.role)) {
    return true;
  }
  return teamMember.functions?.includes("SDR") ?? false;
}

export function hasLeadActivityAccess(teamMember: BotPolicyTeamMember): boolean {
  if (isManagerLikeRole(teamMember.role)) {
    return true;
  }
  return (
    (teamMember.functions?.includes("SDR") ?? false) ||
    (teamMember.functions?.includes("CLOSER") ?? false)
  );
}
