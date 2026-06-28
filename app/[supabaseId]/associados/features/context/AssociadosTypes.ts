export type AssociateProposalRow = {
  leadId: string;
  leadCode: string;
  leadName: string;
  leadPhone: string | null;
  associateAccountId: string;
  associateAccountName: string;
  teamId: string;
  teamName: string;
  closerId: string | null;
  closerName: string | null;
  soldPlan: string | null;
  ticket: number | null;
  statusEnteredAt: string;
  reviewStatus: "pending" | "submitted" | "criticized" | "approved";
  criticizedTitle: string | null;
  requiredDocumentsSummary: {
    pending: number;
    uploaded: number;
    approved: number;
  };
};

export type AssociadosFiltersState = {
  search: string;
  associateAccountId: string;
  teamId: string;
  closerId: string;
  page: number;
  pageSize: number;
};

export type AssociadosData = {
  items: AssociateProposalRow[];
  pagination: {
    page: number;
    pageSize: number;
    totalItems: number;
    totalPages: number;
  };
};

export interface IAssociadosState {
  isLoading: boolean;
  error: string | null;
  data: AssociadosData | null;
  filters: AssociadosFiltersState;
  selectedLeadId: string | null;
  drawerOpen: boolean;
}

export interface IAssociadosActions {
  load: () => Promise<void>;
  setFilters: (patch: Partial<AssociadosFiltersState>) => void;
  openLead: (leadId: string) => void;
  closeDrawer: () => void;
  criticize: (input: { title: string; message: string }) => Promise<void>;
  registerSale: (input: {
    operatorName: string;
    proposalNumber?: string;
    notes?: string;
  }) => Promise<void>;
}

export interface IAssociadosContext extends IAssociadosState, IAssociadosActions {}

export const DEFAULT_ASSOCIADOS_FILTERS: AssociadosFiltersState = {
  search: "",
  associateAccountId: "",
  teamId: "",
  closerId: "",
  page: 1,
  pageSize: 20,
};
