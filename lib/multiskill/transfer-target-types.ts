export type TransferTargetCloserRef = {
  profileId: string;
  fullName: string | null;
  email: string;
};

export type TransferTargetItem = {
  teamId: string;
  teamName: string;
  mode: "internal" | "multiskill";
  masterId?: string;
  masterName?: string | null;
  masterEmail?: string;
  closers?: TransferTargetCloserRef[];
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
