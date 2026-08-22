import type { LeadStatus } from "@prisma/client";

export type LeadTransferProfileRef = {
  id: string;
  fullName: string | null;
  email: string;
};

export type LeadTransferPendingRow = {
  kind: "pending";
  leadId: string;
  leadName: string;
  leadEmail: string | null;
  leadPhone: string | null;
  leadStatus: LeadStatus | null;
  sdr: LeadTransferProfileRef | null;
  closer: LeadTransferProfileRef | null;
  preScheduledAt: Date | null;
  sortDate: Date;
  updatedAt: Date;
};

export type LeadTransferCompletedRow = {
  kind: "completed";
  transferId: string;
  leadId: string;
  leadName: string;
  leadEmail: string | null;
  leadPhone: string | null;
  leadStatus: LeadStatus | null;
  sdr: LeadTransferProfileRef | null;
  closer: LeadTransferProfileRef | null;
  destinationTeamId: string;
  destinationTeamName: string;
  transferredBy: LeadTransferProfileRef;
  transferDate: Date;
  preScheduledAt: Date | null;
  sortDate: Date;
};

export type LeadTransferListFilters = {
  teamId: string;
  search?: string;
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
  multiskillOnly?: boolean;
};

export interface ILeadTransferRepository {
  /**
   * Indica se o lead ja foi transferido a partir do time informado. Usado para
   * autorizar que um manager do time de origem ainda visualize um lead que
   * saiu do time dele.
   */
  existsTransferFromTeam(params: { leadId: string; fromTeamId: string }): Promise<boolean>;
  findPendingByTeam(filters: LeadTransferListFilters): Promise<LeadTransferPendingRow[]>;
  findCompletedByTeam(filters: LeadTransferListFilters): Promise<LeadTransferCompletedRow[]>;
  findFacetsByTeam(teamId: string): Promise<{
    destinationTeams: Array<{ id: string; name: string }>;
    transferredBy: Array<{ id: string; fullName: string | null; email: string }>;
  }>;
}
