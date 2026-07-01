import type { UserFunction, UserRole } from "@prisma/client";
import type { TeamAccess } from "@/app/api/v1/utils/teamAccess";
import {
  hasLeadAccess,
  hasLeadActivityAccess,
  isManagerOrMaster,
} from "@/app/api/v1/utils/teamAccess";

export type BotPolicyAction =
  | "view_lead_list"
  | "view_lead_detail"
  | "add_note"
  | "upload_attachment"
  | "schedule_meeting"
  | "cancel_meeting"
  | "create_task"
  | "view_team_digest"
  | "transfer_lead";

export type BotPolicyContext = {
  access: TeamAccess;
  lead?: {
    assignedToId?: string | null;
    closerId?: string | null;
  };
};

export class BotPolicyService {
  canViewLeadList(ctx: BotPolicyContext): boolean {
    const { access } = ctx;
    if (access.isMaster) return true;
    if (isManagerOrMaster(access)) return true;
    return hasLeadAccess(access.teamMember);
  }

  canViewLeadDetail(ctx: BotPolicyContext): boolean {
    return this.canViewLeadList(ctx);
  }

  canAddNote(ctx: BotPolicyContext): boolean {
    const { access } = ctx;
    if (access.isMaster || isManagerOrMaster(access)) return true;
    return hasLeadActivityAccess(access.teamMember);
  }

  canUploadAttachment(ctx: BotPolicyContext): boolean {
    return this.canAddNote(ctx) && this.canViewLeadDetail(ctx);
  }

  canScheduleMeeting(ctx: BotPolicyContext): boolean {
    const { access, lead } = ctx;
    if (access.isMaster || isManagerOrMaster(access)) return true;
    if (!lead) return false;
    return lead.assignedToId === access.profileId || lead.closerId === access.profileId;
  }

  canCancelMeeting(ctx: BotPolicyContext): boolean {
    return this.canScheduleMeeting(ctx);
  }

  canCreateTask(ctx: BotPolicyContext): boolean {
    return this.canViewLeadDetail(ctx);
  }

  canViewTeamDigest(ctx: BotPolicyContext): boolean {
    return ctx.access.isMaster || isManagerOrMaster(ctx.access);
  }

  canTransferLead(ctx: BotPolicyContext): boolean {
    const { access } = ctx;
    return access.isMaster || access.canTransferAccountLeads;
  }

  assertAction(action: BotPolicyAction, ctx: BotPolicyContext): boolean {
    switch (action) {
      case "view_lead_list":
        return this.canViewLeadList(ctx);
      case "view_lead_detail":
        return this.canViewLeadDetail(ctx);
      case "add_note":
        return this.canAddNote(ctx);
      case "upload_attachment":
        return this.canUploadAttachment(ctx);
      case "schedule_meeting":
        return this.canScheduleMeeting(ctx);
      case "cancel_meeting":
        return this.canCancelMeeting(ctx);
      case "create_task":
        return this.canCreateTask(ctx);
      case "view_team_digest":
        return this.canViewTeamDigest(ctx);
      case "transfer_lead":
        return this.canTransferLead(ctx);
      default: {
        const _exhaustive: never = action;
        return _exhaustive;
      }
    }
  }

  getRoleSummary(teamMember: { role: UserRole; functions: UserFunction[] }) {
    return {
      role: teamMember.role,
      functions: teamMember.functions,
      hasLeadAccess: hasLeadAccess(teamMember),
      hasLeadActivityAccess: hasLeadActivityAccess(teamMember),
    };
  }
}

export const botPolicyService = new BotPolicyService();
