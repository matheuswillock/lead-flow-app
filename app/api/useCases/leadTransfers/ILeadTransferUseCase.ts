import type { LeadStatus } from "@prisma/client";
import type { TeamAccess } from "@/app/api/v1/utils/teamAccess";
import type { Output } from "@/lib/output";

export type LeadTransferListQuery = {
  search?: string;
  transferStatuses?: Array<"pending" | "completed">;
  multiskillOnly?: boolean;
  leadStatus?: string;
  toTeamIds?: string[];
  transferredByProfileIds?: string[];
  sdrProfileIds?: string[];
  closerProfileIds?: string[];
  transferDateFrom?: Date;
  transferDateTo?: Date;
  preScheduledDateFrom?: Date;
  preScheduledDateTo?: Date;
  scheduledDateFrom?: Date;
  scheduledDateTo?: Date;
  page?: number;
  pageSize?: number;
};

export type LeadTransferListMemberRef = {
  id: string;
  fullName: string | null;
  email: string;
};

export type LeadTransferListItem = {
  transferState: "pending" | "completed";
  transferId: string | null;
  leadId: string;
  leadName: string;
  leadEmail: string | null;
  leadPhone: string | null;
  leadStatus: LeadStatus | null;
  sdr: LeadTransferListMemberRef | null;
  closer: LeadTransferListMemberRef | null;
  destinationTeam: { id: string; name: string } | null;
  transferredBy: LeadTransferListMemberRef | null;
  transferDate: string | null;
  preScheduledAt: string | null;
  sortDate: string;
};

export type LeadTransferListResult = {
  items: LeadTransferListItem[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  facets: {
    destinationTeams: Array<{ id: string; name: string }>;
    transferredBy: Array<{ id: string; fullName: string | null; email: string }>;
  };
};

export interface ILeadTransferUseCase {
  listWithCtx(ctx: TeamAccess, query: LeadTransferListQuery): Promise<Output>;
}
