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
  leadStatus: LeadStatus;
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
  leadStatus: LeadStatus;
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
  toTeamId?: string;
  transferredByProfileId?: string;
  dateFrom?: Date;
  dateTo?: Date;
};

export interface ILeadTransferRepository {
  findPendingByTeam(filters: LeadTransferListFilters): Promise<LeadTransferPendingRow[]>;
  findCompletedByTeam(filters: LeadTransferListFilters): Promise<LeadTransferCompletedRow[]>;
  findFacetsByTeam(teamId: string): Promise<{
    destinationTeams: Array<{ id: string; name: string }>;
    transferredBy: Array<{ id: string; fullName: string | null; email: string }>;
  }>;
}
