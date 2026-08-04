export type TransferTargetMemberRef = {
  profileId: string;
  fullName: string | null;
  email: string;
  googleCalendarConnected?: boolean;
};

/** @deprecated Prefer TransferTargetMemberRef */
export type TransferTargetCloserRef = TransferTargetMemberRef;

export type TransferTargetItem = {
  teamId: string;
  teamName: string;
  mode: "internal" | "multiskill";
  masterId?: string;
  masterName?: string | null;
  masterEmail?: string;
  closers?: TransferTargetMemberRef[];
  sdrs?: TransferTargetMemberRef[];
};

export type ListTransferTargetsResult = {
  items: TransferTargetItem[];
  canExternalMultiskill: boolean;
  pagination: {
    page: number;
    pageSize: number;
    totalItems: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPreviousPage: boolean;
  };
};
