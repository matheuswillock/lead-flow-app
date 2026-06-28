import type {
  AssociadosData,
  AssociadosFiltersState,
  AssociateProposalDetail,
  AssociateRequiredDocument,
  LeadAttachmentOption,
} from "../context/AssociadosTypes";

export interface IAssociadosService {
  listProposals(
    supabaseId: string,
    teamId: string,
    filters: AssociadosFiltersState
  ): Promise<AssociadosData>;

  getDetail(
    supabaseId: string,
    teamId: string,
    leadId: string
  ): Promise<AssociateProposalDetail>;

  listLeadAttachments(
    supabaseId: string,
    teamId: string,
    leadId: string
  ): Promise<LeadAttachmentOption[]>;

  criticize(
    supabaseId: string,
    teamId: string,
    leadId: string,
    input: { title: string; message: string }
  ): Promise<void>;

  registerSale(
    supabaseId: string,
    teamId: string,
    leadId: string,
    input: {
      operatorName: string;
      proposalNumber?: string;
      notes?: string;
      attachmentIds?: string[];
    }
  ): Promise<void>;

  approveDocument(
    supabaseId: string,
    teamId: string,
    leadId: string,
    documentType: AssociateRequiredDocument["documentType"]
  ): Promise<void>;

  rejectDocument(
    supabaseId: string,
    teamId: string,
    leadId: string,
    documentType: AssociateRequiredDocument["documentType"],
    reason: string
  ): Promise<void>;

  linkDocument(
    supabaseId: string,
    teamId: string,
    leadId: string,
    input: { documentType: AssociateRequiredDocument["documentType"]; attachmentId: string }
  ): Promise<void>;

  uploadPaymentProof(
    supabaseId: string,
    teamId: string,
    leadId: string,
    attachmentId: string
  ): Promise<void>;
}
