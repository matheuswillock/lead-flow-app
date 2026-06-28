import { LeadStatus } from "@prisma/client";
import { Output } from "@/lib/output";
import { notificationService } from "@/app/api/services/notifications/NotificationService";
import { dispatchWebPushToProfile } from "@/app/api/infra/webPush/dispatchWebPush";
import { STUDIO_FEED_IDENTITY } from "@/app/api/infra/data/repositories/associateProposal/AssociateProposalRepository";
import type { AssociateBackofficeAccess } from "@/app/api/useCases/associateProposal/AssociateBackofficeAccessTypes";
import {
  associateProposalService,
  AssociateProposalService,
} from "@/app/api/services/associateProposal/AssociateProposalService";
import type { AssociateProposalListQuery } from "@/app/api/infra/data/repositories/associateProposal/AssociateProposalRepository";
import type { LeadRequiredDocumentType } from "@prisma/client";

export class AssociateProposalUseCase {
  constructor(private readonly service: AssociateProposalService = associateProposalService) {}

  async list(access: AssociateBackofficeAccess, query: Omit<AssociateProposalListQuery, "sponsorProfileId">) {
    try {
      const result = await this.service.list({
        ...query,
        sponsorProfileId: access.sponsorProfileId,
      });
      return new Output(true, ["Propostas listadas"], [], result);
    } catch (error) {
      console.error("[AssociateProposalUseCase][list]", error);
      return new Output(false, [], ["Erro ao listar propostas"], null);
    }
  }

  async getDetail(access: AssociateBackofficeAccess, leadId: string) {
    try {
      const detail = await this.service.getDetail(leadId, access.sponsorProfileId);
      if (!detail) {
        return new Output(false, [], ["Proposta não encontrada"], null);
      }
      return new Output(true, ["Detalhe carregado"], [], detail);
    } catch (error) {
      console.error("[AssociateProposalUseCase][getDetail]", error);
      return new Output(false, [], ["Erro ao carregar proposta"], null);
    }
  }

  async notifyAssociateOfferSubmission(input: {
    leadId: string;
    teamId: string;
    leadCode: string;
    leadName: string;
    actorProfileId: string;
    actorName: string;
  }) {
    const recipients = await this.service.findAssociateOfferNotificationRecipients(input.teamId);
    if (!recipients?.recipientIds.length) return;

    await this.service.ensureProposalArtifacts(input.leadId);

    await notificationService
      .createLeadProposalPendingNotification({
        teamId: input.teamId,
        actorProfileId: input.actorProfileId,
        actorName: input.actorName,
        recipientProfileIds: recipients.recipientIds,
        leadId: input.leadId,
        leadCode: input.leadCode,
        leadName: input.leadName,
        leadEmail: null,
        leadPhone: null,
        sdrName: "—",
        closerName: "—",
        notes: null,
        previousStatus: LeadStatus.offerNegotiation,
        nextStatus: LeadStatus.offerSubmission,
      })
      .catch((err) => console.error("[AssociateProposalUseCase][notify]", err));

    await Promise.all(
      recipients.recipientIds.map((profileId) =>
        dispatchWebPushToProfile({
          profileId,
          teamId: input.teamId,
          type: "LEAD_PROPOSAL_PENDING",
          message: `${input.leadName} aguarda registro na operadora`,
          metadata: { leadId: input.leadId },
        })
      )
    ).catch((err) => console.error("[AssociateProposalUseCase][webPush]", err));
  }

  async resetReviewOnResubmit(leadId: string) {
    await this.service.resetReviewOnResubmit(leadId);
  }

  async evaluateRequiredDocumentsForOfferSubmission(leadId: string, teamId: string) {
    return this.service.evaluateRequiredDocumentsForOfferSubmission(leadId, teamId);
  }

  async criticize(
    access: AssociateBackofficeAccess,
    leadId: string,
    input: { title: string; message: string }
  ) {
    try {
      const result = await this.service.criticizeProposal(access, leadId, input);

      if (result.assigneeId && result.createdTaskId) {
        await notificationService
          .createTaskAssignmentNotifications({
            actorProfileId: access.profileId,
            actorName: STUDIO_FEED_IDENTITY.displayAuthor,
            recipientProfileIds: [result.assigneeId],
            leadId,
            leadCode: result.lead.leadCode,
            leadName: result.lead.name,
            taskId: result.createdTaskId,
            body: input.message,
            teamId: result.lead.teamId!,
          })
          .catch((err) => console.error("[AssociateProposalUseCase][criticize][notify]", err));
      }

      return new Output(true, ["Proposta criticada"], [], {
        leadId: result.leadId,
        reviewStatus: result.reviewStatus,
      });
    } catch (error) {
      const statusCode = (error as Error & { statusCode?: number }).statusCode;
      const message = error instanceof Error ? error.message : "Erro ao criticar proposta";
      console.error("[AssociateProposalUseCase][criticize]", error);
      const output = new Output(false, [], [message], null);
      (output as Output & { httpStatus?: number }).httpStatus = statusCode ?? 400;
      return output;
    }
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
    try {
      const result = await this.service.registerSale(access, leadId, input);
      return new Output(true, ["Venda registrada"], [], result);
    } catch (error) {
      console.error("[AssociateProposalUseCase][registerSale]", error);
      return new Output(false, [], [error instanceof Error ? error.message : "Erro ao registrar venda"], null);
    }
  }

  async approveDocument(
    access: AssociateBackofficeAccess,
    leadId: string,
    documentType: LeadRequiredDocumentType
  ) {
    try {
      const result = await this.service.approveDocument(access, leadId, documentType);
      return new Output(true, ["Documento aprovado"], [], result);
    } catch (error) {
      console.error("[AssociateProposalUseCase][approveDocument]", error);
      return new Output(false, [], [error instanceof Error ? error.message : "Erro ao aprovar documento"], null);
    }
  }

  async uploadPaymentProof(access: AssociateBackofficeAccess, leadId: string, attachmentId: string) {
    try {
      const result = await this.service.uploadPaymentProof(access, leadId, attachmentId);
      return new Output(true, ["Comprovante registrado"], [], result);
    } catch (error) {
      console.error("[AssociateProposalUseCase][uploadPaymentProof]", error);
      return new Output(
        false,
        [],
        [error instanceof Error ? error.message : "Erro ao registrar comprovante"],
        null
      );
    }
  }
}

export const associateProposalUseCase = new AssociateProposalUseCase();
