export interface MultiskillTransferTargetMember {
  profileId: string;
  fullName: string | null;
  email: string;
  teamId: string;
  teamName: string;
  googleCalendarConnected: boolean;
}

/** @deprecated Prefer MultiskillTransferTargetMember */
export type MultiskillTransferTargetCloser = MultiskillTransferTargetMember;

export interface MultiskillTransferTarget {
  masterId: string;
  masterName: string | null;
  masterEmail: string;
  defaultTeamId: string;
  defaultTeamName: string;
  closers: MultiskillTransferTargetMember[];
  sdrs: MultiskillTransferTargetMember[];
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
  name: string;
  leadCode: string | null;
  assignedTo: string | null;
  closerId: string | null;
  isTransfer: boolean;
  meetingDate: Date | null;
  meetingTitle: string | null;
  meetingNotes: string | null;
  meetingType: string | null;
  team: { masterId: string } | null;
}
