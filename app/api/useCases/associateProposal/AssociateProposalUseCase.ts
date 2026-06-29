import { LeadStatus } from "@prisma/client";
import { Output } from "@/lib/output";
import { getEmailService } from "@/lib/services/EmailService";
import { notificationService } from "@/app/api/services/notifications/NotificationService";
import { dispatchWebPushToProfile } from "@/app/api/infra/webPush/dispatchWebPush";
import {
  associateProposalRepository,
  STUDIO_FEED_IDENTITY,
} from "@/app/api/infra/data/repositories/associateProposal/AssociateProposalRepository";
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

    await this.notifyRequiredDocumentsPending({
      leadId: input.leadId,
      teamId: input.teamId,
      leadCode: input.leadCode,
      leadName: input.leadName,
      actorProfileId: input.actorProfileId,
      actorName: input.actorName,
      recipientProfileIds: recipients.recipientIds,
    });

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

    if (recipients.recipientEmails.length > 0) {
      getEmailService()
        .sendLeadProposalPendingUrgentEmail({
          to: recipients.recipientEmails,
          leadCode: input.leadCode,
          leadName: input.leadName,
          leadEmail: null,
          leadPhone: null,
          sdrName: "—",
          closerName: "—",
          notes: "Proposta de conta associada aguardando registro na operadora.",
          actorName: input.actorName,
        })
        .catch((err) => console.error("[AssociateProposalUseCase][notify][email]", err));
    }
  }

  async resetReviewOnResubmit(leadId: string) {
    await this.service.resetReviewOnResubmit(leadId);
  }

  async evaluateRequiredDocumentsForOfferSubmission(leadId: string, teamId: string) {
    return this.service.evaluateRequiredDocumentsForOfferSubmission(leadId, teamId);
  }

  async notifyRequiredDocumentsPending(input: {
    leadId: string;
    teamId: string;
    leadCode: string;
    leadName: string;
    actorProfileId: string;
    actorName: string;
    recipientProfileIds: string[];
  }) {
    const hasPending = await this.service.hasPendingRequiredDocuments(input.leadId);
    if (!hasPending || input.recipientProfileIds.length === 0) return;

    const message = `Documentos obrigatórios pendentes para ${input.leadName}`;

    await notificationService
      .createLeadProposalPendingNotification({
        teamId: input.teamId,
        actorProfileId: input.actorProfileId,
        actorName: input.actorName,
        recipientProfileIds: input.recipientProfileIds,
        leadId: input.leadId,
        leadCode: input.leadCode,
        leadName: input.leadName,
        leadEmail: null,
        leadPhone: null,
        sdrName: "—",
        closerName: "—",
        notes: "Revise e aprove os documentos obrigatórios na fila Associados.",
        previousStatus: LeadStatus.offerNegotiation,
        nextStatus: LeadStatus.pending_documents,
      })
      .catch((err) => console.error("[AssociateProposalUseCase][notifyRequiredDocumentsPending]", err));

    await Promise.all(
      input.recipientProfileIds.map((profileId) =>
        dispatchWebPushToProfile({
          profileId,
          teamId: input.teamId,
          type: "LEAD_PROPOSAL_PENDING",
          message,
          metadata: { leadId: input.leadId },
        })
      )
    ).catch((err) => console.error("[AssociateProposalUseCase][notifyRequiredDocumentsPending][webPush]", err));

    const recipientEmails = (
      await Promise.all(
        input.recipientProfileIds.map((id) => associateProposalRepository.findProfileEmail(id))
      )
    )
      .map((profile) => profile?.email)
      .filter((email): email is string => Boolean(email?.trim()));

    if (recipientEmails.length > 0) {
      getEmailService()
        .sendAssociateRequiredDocumentsPendingEmail({
          to: Array.from(new Set(recipientEmails)),
          leadCode: input.leadCode,
          leadName: input.leadName,
          actorName: input.actorName,
        })
        .catch((err) =>
          console.error("[AssociateProposalUseCase][notifyRequiredDocumentsPending][email]", err)
        );
    }
  }

  async criticize(
    access: AssociateBackofficeAccess,
    leadId: string,
    input: { title: string; message: string }
  ) {
    try {
      const result = await this.service.criticizeProposal(access, leadId, input);

      const notifyRecipientId =
        result.assigneeId ?? result.lead.team?.masterId ?? null;

      if (notifyRecipientId && result.createdTaskId) {
        await notificationService
          .createTaskAssignmentNotifications({
            actorProfileId: access.profileId,
            actorName: STUDIO_FEED_IDENTITY.displayAuthor,
            recipientProfileIds: [notifyRecipientId],
            leadId,
            leadCode: result.lead.leadCode,
            leadName: result.lead.name,
            taskId: result.createdTaskId,
            body: input.message,
            teamId: result.lead.teamId!,
          })
          .catch((err) => console.error("[AssociateProposalUseCase][criticize][notify]", err));
      } else if (notifyRecipientId) {
        await notificationService
          .createLeadProposalPendingNotification({
            teamId: result.lead.teamId!,
            actorProfileId: access.profileId,
            actorName: STUDIO_FEED_IDENTITY.displayAuthor,
            recipientProfileIds: [notifyRecipientId],
            leadId,
            leadCode: result.lead.leadCode,
            leadName: result.lead.name,
            leadEmail: result.lead.email,
            leadPhone: result.lead.phone,
            sdrName: "—",
            closerName: "—",
            notes: input.message,
            previousStatus: LeadStatus.offerSubmission,
            nextStatus: LeadStatus.offerSubmission,
          })
          .catch((err) => console.error("[AssociateProposalUseCase][criticize][fallbackNotify]", err));
      }

      const criticismRecipientId =
        result.assigneeId ?? result.lead.team?.masterId ?? null;
      if (criticismRecipientId) {
        const recipient = await associateProposalRepository.findProfileEmail(criticismRecipientId);
        if (recipient?.email) {
          getEmailService()
            .sendAssociateProposalCriticismEmail({
              to: [recipient.email],
              leadCode: result.lead.leadCode,
              leadName: result.lead.name,
              title: input.title,
              message: input.message,
            })
            .catch((err) => console.error("[AssociateProposalUseCase][criticize][email]", err));
        }
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

  async linkDocument(
    access: AssociateBackofficeAccess,
    leadId: string,
    input: { documentType: LeadRequiredDocumentType; attachmentId: string }
  ) {
    try {
      const result = await this.service.linkDocument(access, leadId, input);
      return new Output(true, ["Documento vinculado"], [], result);
    } catch (error) {
      console.error("[AssociateProposalUseCase][linkDocument]", error);
      return new Output(false, [], [error instanceof Error ? error.message : "Erro ao vincular documento"], null);
    }
  }

  async rejectDocument(
    access: AssociateBackofficeAccess,
    leadId: string,
    documentType: LeadRequiredDocumentType,
    reason: string
  ) {
    try {
      const result = await this.service.rejectDocument(access, leadId, documentType, reason);
      const lead = await associateProposalRepository.assertLeadBelongsToSponsor(
        leadId,
        access.sponsorProfileId
      );
      const notifyId = lead?.closerId ?? lead?.team?.masterId;
      if (notifyId && lead?.teamId) {
        await notificationService
          .createLeadProposalPendingNotification({
            teamId: lead.teamId,
            actorProfileId: access.profileId,
            actorName: STUDIO_FEED_IDENTITY.displayAuthor,
            recipientProfileIds: [notifyId],
            leadId,
            leadCode: lead.leadCode,
            leadName: lead.name,
            leadEmail: lead.email,
            leadPhone: lead.phone,
            sdrName: "—",
            closerName: "—",
            notes: reason,
            previousStatus: LeadStatus.pending_documents,
            nextStatus: LeadStatus.pending_documents,
          })
          .catch((err) => console.error("[AssociateProposalUseCase][rejectDocument][notify]", err));
      }
      return new Output(true, ["Documento rejeitado"], [], result);
    } catch (error) {
      console.error("[AssociateProposalUseCase][rejectDocument]", error);
      return new Output(false, [], [error instanceof Error ? error.message : "Erro ao rejeitar documento"], null);
    }
  }

  async approveDocument(
    access: AssociateBackofficeAccess,
    leadId: string,
    documentType: LeadRequiredDocumentType
  ) {
    try {
      const result = await this.service.approveDocument(access, leadId, documentType);
      const allApproved = await this.service.hasAllRequiredDocumentsApproved(leadId);
      if (allApproved) {
        const lead = await associateProposalRepository.assertLeadBelongsToSponsor(
          leadId,
          access.sponsorProfileId
        );
        const notifyIds = [lead?.closerId, lead?.team?.masterId].filter(
          (id): id is string => Boolean(id)
        );
        if (notifyIds.length > 0 && lead?.teamId) {
          await notificationService
            .createLeadProposalPendingNotification({
              teamId: lead.teamId,
              actorProfileId: access.profileId,
              actorName: STUDIO_FEED_IDENTITY.displayAuthor,
              recipientProfileIds: Array.from(new Set(notifyIds)),
              leadId,
              leadCode: lead.leadCode,
              leadName: lead.name,
              leadEmail: lead.email,
              leadPhone: lead.phone,
              sdrName: "—",
              closerName: "—",
              notes: "Todos os documentos obrigatórios foram aprovados.",
              previousStatus: LeadStatus.pending_documents,
              nextStatus: LeadStatus.offerSubmission,
            })
            .catch((err) => console.error("[AssociateProposalUseCase][approveDocument][notify]", err));
        }
      }
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
