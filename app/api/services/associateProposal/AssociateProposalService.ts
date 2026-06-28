import {
  LeadStatus,
  type LeadProposalReviewStatus,
  type LeadRequiredDocumentType,
} from "@prisma/client";
import type { AssociateBackofficeAccess } from "@/app/api/useCases/associateProposal/AssociateBackofficeAccessTypes";
import {
  associateProposalRepository,
  type AssociateProposalListQuery,
} from "@/app/api/infra/data/repositories/associateProposal/AssociateProposalRepository";

export class AssociateProposalService {
  async list(query: AssociateProposalListQuery) {
    const result = await associateProposalRepository.listProposals(query);
    return {
      items: result.items.map((item) => ({
        ...item,
        statusEnteredAt: item.statusEnteredAt.toISOString(),
      })),
      pagination: result.pagination,
    };
  }

  async getDetail(leadId: string, sponsorProfileId: string) {
    const lead = await associateProposalRepository.findProposalDetail(leadId, sponsorProfileId);
    if (!lead) return null;
    return lead;
  }

  async ensureProposalArtifacts(leadId: string) {
    await associateProposalRepository.ensureProposalArtifacts(leadId);
  }

  async findAssociateOfferNotificationRecipients(teamId: string) {
    return associateProposalRepository.findAssociateOfferNotificationRecipients(teamId);
  }

  async criticizeProposal(
    access: AssociateBackofficeAccess,
    leadId: string,
    input: { title: string; message: string }
  ) {
    const lead = await associateProposalRepository.assertLeadBelongsToSponsor(
      leadId,
      access.sponsorProfileId
    );

    if (!lead || lead.status !== "offerSubmission") {
      throw new Error("Lead não está em Proposta");
    }

    if (lead.proposalReview?.status === "criticized") {
      const error = new Error("Proposta já criticada");
      (error as Error & { statusCode?: number }).statusCode = 409;
      throw error;
    }

    const assigneeId = lead.closerId ?? lead.team?.masterId ?? null;
    const createdTaskId = await associateProposalRepository.criticizeProposal({
      leadId,
      title: input.title,
      message: input.message,
      reviewedByProfileId: access.profileId,
      assigneeId,
      createdByProfileId: access.profileId,
    });

    return {
      leadId,
      reviewStatus: "criticized" as LeadProposalReviewStatus,
      assigneeId,
      createdTaskId,
      lead,
    };
  }

  async registerSale(
    access: AssociateBackofficeAccess,
    leadId: string,
    input: {
      operatorName: string;
      proposalNumber?: string;
      notes?: string;
      attachmentIds?: string[];
    }
  ) {
    const lead = await associateProposalRepository.assertLeadBelongsToSponsor(
      leadId,
      access.sponsorProfileId
    );

    if (!lead || lead.status !== "offerSubmission") {
      throw new Error("Lead não está em Proposta");
    }

    const salePayload = {
      operatorName: input.operatorName,
      proposalNumber: input.proposalNumber ?? null,
      notes: input.notes ?? null,
      attachmentIds: input.attachmentIds ?? [],
    };

    await associateProposalRepository.registerSale({
      leadId,
      reviewedByProfileId: access.profileId,
      operatorName: input.operatorName,
      salePayload,
    });

    return { leadId, reviewStatus: "approved" as LeadProposalReviewStatus };
  }

  async approveDocument(
    access: AssociateBackofficeAccess,
    leadId: string,
    documentType: LeadRequiredDocumentType
  ) {
    const lead = await associateProposalRepository.assertLeadBelongsToSponsor(
      leadId,
      access.sponsorProfileId
    );
    if (!lead) throw new Error("Lead não encontrado");

    await associateProposalRepository.approveRequiredDocument({
      leadId,
      documentType,
      reviewedByProfileId: access.profileId,
    });

    return { leadId, documentType, status: "approved" };
  }

  async uploadPaymentProof(
    access: AssociateBackofficeAccess,
    leadId: string,
    attachmentId: string
  ) {
    const lead = await associateProposalRepository.assertLeadBelongsToSponsor(
      leadId,
      access.sponsorProfileId
    );

    if (!lead || lead.status !== "invoicePayment") {
      throw new Error("Lead não está em Boleto");
    }

    await associateProposalRepository.uploadPaymentProof(leadId, attachmentId);
    return { leadId, nextStatus: "dps_agreement" as LeadStatus };
  }

  async resetReviewOnResubmit(leadId: string) {
    await associateProposalRepository.resetCriticizedReview(leadId);
  }

  async evaluateRequiredDocumentsForOfferSubmission(leadId: string, teamId: string) {
    const sponsorMasterId = await associateProposalRepository.findTeamSponsorMasterId(teamId);
    if (!sponsorMasterId) {
      return { blocked: false, pendingTypes: [] as LeadRequiredDocumentType[] };
    }

    await associateProposalRepository.ensureProposalArtifacts(leadId);

    const docs = await associateProposalRepository.findRequiredDocumentStatuses(leadId);
    const pendingTypes = docs
      .filter((doc) => doc.status !== "approved")
      .map((doc) => doc.documentType);

    return { blocked: pendingTypes.length > 0, pendingTypes };
  }
}

export const associateProposalService = new AssociateProposalService();
