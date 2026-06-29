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

export type AssociateRequiredDocument = {
  id: string;
  documentType: "rg" | "address_proof" | "social_contract";
  status: "pending" | "uploaded" | "approved" | "rejected";
  attachmentId: string | null;
  attachment: { id: string; fileName: string; fileUrl: string | null } | null;
};

export type AssociateProposalDetail = {
  id: string;
  leadCode: string;
  name: string;
  phone: string | null;
  email: string | null;
  soldPlan: string | null;
  ticket: unknown;
  status: string;
  statusEnteredAt: string;
  closerId: string | null;
  closer: { id: string; fullName: string | null; email: string } | null;
  team: {
    id: string;
    name: string;
    master: { id: string; fullName: string | null; email: string };
  } | null;
  proposalReview: {
    status: string;
    criticizedTitle: string | null;
    criticizedMessage: string | null;
  } | null;
  requiredDocuments: AssociateRequiredDocument[];
  activities: Array<{
    id: string;
    type: string;
    body: string | null;
    payload: unknown;
    createdAt: string;
    createdBy: string | null;
  }>;
};

export type LeadAttachmentOption = {
  id: string;
  fileName: string;
  fileUrl: string | null;
};

export type AssociadosFiltersState = {
  search: string;
  associateAccountId: string;
  teamId: string;
  closerId: string;
  from: string;
  to: string;
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
  detail: AssociateProposalDetail | null;
  detailLoading: boolean;
  detailError: string | null;
  leadAttachments: LeadAttachmentOption[];
}

export interface IAssociadosActions {
  load: () => Promise<void>;
  setFilters: (patch: Partial<AssociadosFiltersState>) => void;
  openLead: (leadId: string) => void;
  closeDrawer: () => void;
  reloadDetail: () => Promise<void>;
  criticize: (input: { title: string; message: string }) => Promise<void>;
  registerSale: (input: {
    operatorName: string;
    proposalNumber?: string;
    notes?: string;
    attachmentIds?: string[];
  }) => Promise<void>;
  approveDocument: (documentType: AssociateRequiredDocument["documentType"]) => Promise<void>;
  rejectDocument: (
    documentType: AssociateRequiredDocument["documentType"],
    reason: string
  ) => Promise<void>;
  linkDocument: (
    documentType: AssociateRequiredDocument["documentType"],
    attachmentId: string
  ) => Promise<void>;
  uploadPaymentProof: (attachmentId: string) => Promise<void>;
}

export interface IAssociadosContext extends IAssociadosState, IAssociadosActions {}

export const DEFAULT_ASSOCIADOS_FILTERS: AssociadosFiltersState = {
  search: "",
  associateAccountId: "",
  teamId: "",
  closerId: "",
  from: "",
  to: "",
  page: 1,
  pageSize: 20,
};

export const DOCUMENT_TYPE_LABELS: Record<AssociateRequiredDocument["documentType"], string> = {
  rg: "RG",
  address_proof: "Comprovante de Endereço",
  social_contract: "Contrato Social",
};
