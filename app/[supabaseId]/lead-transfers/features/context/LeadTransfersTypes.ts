import type { LeadStatus } from "@prisma/client";

export type LeadTransferStateFilter = "pending" | "completed";

export type LeadTransferMemberRef = {
  id: string;
  fullName: string | null;
  email: string;
};

export type LeadTransferRow = {
  transferState: "pending" | "completed";
  transferId: string | null;
  leadId: string;
  leadName: string;
  leadEmail: string | null;
  leadPhone: string | null;
  leadStatus: LeadStatus;
  sdr: LeadTransferMemberRef | null;
  closer: LeadTransferMemberRef | null;
  destinationTeam: { id: string; name: string } | null;
  transferredBy: LeadTransferMemberRef | null;
  transferDate: string | null;
  preScheduledAt: string | null;
  sortDate: string;
};

export type LeadTransferFacets = {
  destinationTeams: Array<{ id: string; name: string }>;
  transferredBy: LeadTransferMemberRef[];
};

export type LeadTransfersData = {
  items: LeadTransferRow[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  facets: LeadTransferFacets;
};

export type LeadTransfersFiltersState = {
  search: string;
  transferStatuses: LeadTransferStateFilter[];
  multiskillOnly: boolean;
  leadStatus: LeadStatus | "";
  toTeamIds: string[];
  transferredByProfileIds: string[];
  sdrProfileIds: string[];
  closerProfileIds: string[];
  transferDateFrom: string;
  transferDateTo: string;
  preScheduledDateFrom: string;
  preScheduledDateTo: string;
  scheduledDateFrom: string;
  scheduledDateTo: string;
  page: number;
  pageSize: number;
};

export const DEFAULT_LEAD_TRANSFERS_FILTERS: LeadTransfersFiltersState = {
  search: "",
  transferStatuses: [],
  multiskillOnly: false,
  leadStatus: "",
  toTeamIds: [],
  transferredByProfileIds: [],
  sdrProfileIds: [],
  closerProfileIds: [],
  transferDateFrom: "",
  transferDateTo: "",
  preScheduledDateFrom: "",
  preScheduledDateTo: "",
  scheduledDateFrom: "",
  scheduledDateTo: "",
  page: 1,
  pageSize: 10,
};

export function isLeadTransfersFiltersChanged(filters: LeadTransfersFiltersState): boolean {
  return (
    filters.search.trim().length > 0 ||
    filters.transferStatuses.length > 0 ||
    filters.multiskillOnly ||
    filters.leadStatus !== "" ||
    filters.toTeamIds.length > 0 ||
    filters.transferredByProfileIds.length > 0 ||
    filters.sdrProfileIds.length > 0 ||
    filters.closerProfileIds.length > 0 ||
    filters.transferDateFrom !== "" ||
    filters.transferDateTo !== "" ||
    filters.preScheduledDateFrom !== "" ||
    filters.preScheduledDateTo !== "" ||
    filters.scheduledDateFrom !== "" ||
    filters.scheduledDateTo !== ""
  );
}
