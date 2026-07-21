export interface MultiskillTransferTargetCloser {
  profileId: string;
  fullName: string | null;
  email: string;
  teamId: string;
  teamName: string;
}

export interface MultiskillTransferTarget {
  masterId: string;
  masterName: string | null;
  masterEmail: string;
  defaultTeamId: string;
  defaultTeamName: string;
  closers: MultiskillTransferTargetCloser[];
}

export interface ListMultiskillTransferTargetsResult {
  items: MultiskillTransferTarget[];
  pagination: {
    page: number;
    pageSize: number;
    totalItems: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPreviousPage: boolean;
  };
}

export interface MultiskillTransferLeadRecord {
  id: string;
  status: string | null;
  managerId: string | null;
  teamId: string | null;
  email: string | null;
  cnpj: string | null;
  isTransfer: boolean;
  meetingDate: Date | null;
  team: { masterId: string } | null;
}
