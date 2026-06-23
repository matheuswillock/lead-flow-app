import type { LeadStatus } from "@prisma/client";

export type LeadTransferStateFilter = "all" | "pending" | "completed";

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
  status: LeadTransferStateFilter;
  leadStatus: LeadStatus | "";
  toTeamId: string;
  transferredByProfileId: string;
  dateFrom: string;
  dateTo: string;
  page: number;
  pageSize: number;
};

export const DEFAULT_LEAD_TRANSFERS_FILTERS: LeadTransfersFiltersState = {
  search: "",
  status: "all",
  leadStatus: "",
  toTeamId: "",
  transferredByProfileId: "",
  dateFrom: "",
  dateTo: "",
  page: 1,
  pageSize: 10,
};
