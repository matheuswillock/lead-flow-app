import type { UserFunction, UserRole } from "@prisma/client";
import {
  isAllowedBotAction,
  READ_ACTIONS,
  resolvePolicyAction,
  WRITE_ACTIONS,
  type BotPolicyAction,
} from "./botPolicy/allowlist";
import {
  buildActionIdempotencyKey,
  buildInboundIdempotencyKey,
} from "./botPolicy/idempotency";
import {
  hasLeadAccess,
  hasLeadActivityAccess,
  isManagerOrMasterAccess,
  type BotPolicyAccessLike,
} from "./botPolicy/role-access";
import {
  INBOUND_REJECTED_USER_MESSAGE,
  sanitizeInboundMessage,
  type SanitizeInboundResult,
} from "./botPolicy/sanitize-inbound";
import {
  assertTeamScope,
  type TeamScopeInput,
  type TeamScopeResult,
} from "./botPolicy/team-scope";

export type { BotPolicyAction };

export type BotPolicyContext = {
  access: BotPolicyAccessLike;
  lead?: {
    assignedToId?: string | null;
    closerId?: string | null;
  };
};

/**
 * Bot Policy Service / Guard Rails — single lib for what Bethânia may read/write,
 * team isolation, inbound sanitization, and idempotency helpers.
 */
export class BotPolicyService {
  canViewLeadList(ctx: BotPolicyContext): boolean {
    const { access } = ctx;
    if (access.isMaster) return true;
    if (isManagerOrMasterAccess(access)) return true;
    return hasLeadAccess(access.teamMember);
  }

  canViewLeadDetail(ctx: BotPolicyContext): boolean {
    return this.canViewLeadList(ctx);
  }

  canAddNote(ctx: BotPolicyContext): boolean {
    const { access } = ctx;
    if (access.isMaster || isManagerOrMasterAccess(access)) return true;
    return hasLeadActivityAccess(access.teamMember);
  }

  canUploadAttachment(ctx: BotPolicyContext): boolean {
    return this.canAddNote(ctx) && this.canViewLeadDetail(ctx);
  }

  canScheduleMeeting(ctx: BotPolicyContext): boolean {
    const { access, lead } = ctx;
    if (access.isMaster || isManagerOrMasterAccess(access)) return true;
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
    return ctx.access.isMaster || isManagerOrMasterAccess(ctx.access);
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

  isAllowedAction(action: string): boolean {
    return isAllowedBotAction(action);
  }

  resolvePolicyAction(action: string): BotPolicyAction | null {
    return resolvePolicyAction(action);
  }

  isReadAction(action: string): boolean {
    return READ_ACTIONS.has(action);
  }

  isWriteAction(action: string): boolean {
    return WRITE_ACTIONS.has(action);
  }

  assertTeamScope(input: TeamScopeInput): TeamScopeResult {
    return assertTeamScope(input);
  }

  sanitizeInboundMessage(text: string): SanitizeInboundResult {
    return sanitizeInboundMessage(text);
  }

  getInboundRejectedUserMessage(): string {
    return INBOUND_REJECTED_USER_MESSAGE;
  }

  buildInboundIdempotencyKey(channelMessageId: string): string {
    return buildInboundIdempotencyKey(channelMessageId);
  }

  buildActionIdempotencyKey(input: {
    userLinkId: string;
    action: string;
    teamId: string;
    canonicalParams: unknown;
    channelMessageId?: string | null;
  }): string {
    return buildActionIdempotencyKey(input);
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

export type { TeamScopeInput, TeamScopeResult, SanitizeInboundResult };
