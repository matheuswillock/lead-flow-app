import { randomUUID } from "node:crypto";
import { NotificationType } from "@prisma/client";
import { Output } from "@/lib/output";
import { prisma } from "@/app/api/infra/data/prisma";
import { notificationService } from "@/app/api/services/notifications/NotificationService";
import { createSupabaseAdmin } from "@/lib/supabase/server";
import { STORAGE_BUCKETS } from "@/lib/supabase/storage";
import { getAppUrl } from "@/lib/utils/app-url";
import type {
  ILeadDocumentRequestUseCase,
  CreateRequestInput,
  UploadItemFile,
} from "./ILeadDocumentRequestUseCase";
import type { ILeadDocumentRequestService } from "@/app/api/services/leadDocumentRequest/ILeadDocumentRequestService";

const TWO_DAYS_MS = 2 * 24 * 60 * 60 * 1000;

const itemSelectFields = {
  id: true,
  name: true,
  description: true,
  isRequired: true,
  uploadedAt: true,
  attachmentId: true,
  createdAt: true,
  updatedAt: true,
};

export class LeadDocumentRequestUseCase implements ILeadDocumentRequestUseCase {
  constructor(private readonly service: ILeadDocumentRequestService) {}

  async listRequests(leadId: string, teamId: string): Promise<Output> {
    const lead = await prisma.lead.findUnique({
      where: { id: leadId },
      select: { id: true, teamId: true },
    });

    if (!lead || lead.teamId !== teamId) {
      return new Output(false, [], ["Lead não encontrado ou sem permissão no seu time."], null);
    }

    const requests = await prisma.leadDocumentRequest.findMany({
      where: { leadId },
      select: {
        id: true,
        leadId: true,
        teamId: true,
        createdByProfileId: true,
        publicToken: true,
        message: true,
        status: true,
        lastEmailSentAt: true,
        completedAt: true,
        createdAt: true,
        updatedAt: true,
        items: { select: itemSelectFields },
      },
      orderBy: { createdAt: "desc" },
    });

    return new Output(true, [], [], requests);
  }

  async createRequest(input: CreateRequestInput): Promise<Output> {
    const { leadId, teamId, profileId, documents, message } = input;

    const lead = await prisma.lead.findUnique({
      where: { id: leadId },
      select: { id: true, teamId: true, name: true, email: true },
    });

    if (!lead || lead.teamId !== teamId) {
      return new Output(false, [], ["Lead não encontrado ou sem permissão no seu time."], null);
    }

    if (!lead.email) {
      return new Output(
        false,
        [],
        ["O lead não possui e-mail cadastrado. Adicione um e-mail antes de solicitar documentos."],
        null
      );
    }

    const creator = await prisma.profile.findUnique({
      where: { id: profileId },
      select: { fullName: true },
    });

    const publicToken = randomUUID();

    const request = await prisma.$transaction(async (tx) => {
      const created = await tx.leadDocumentRequest.create({
        data: {
          leadId,
          teamId,
          createdByProfileId: profileId,
          publicToken,
          message: message ?? null,
          items: {
            create: documents.map((name) => ({
              name,
              isRequired: true,
            })),
          },
        },
        select: {
          id: true,
          leadId: true,
          teamId: true,
          publicToken: true,
          message: true,
          status: true,
          createdAt: true,
          updatedAt: true,
          items: { select: itemSelectFields },
        },
      });
      return created;
    });

    const appUrl = getAppUrl();
    const publicUrl = `${appUrl}/documentos/${publicToken}`;
    const closerName = creator?.fullName ?? "Corretor";

    try {
      await this.service.sendRequestEmail(lead.email, {
        closerName,
        leadName: lead.name,
        publicUrl,
        documents,
        message,
      });

      await prisma.leadDocumentRequest.update({
        where: { id: request.id },
        data: { lastEmailSentAt: new Date() },
      });
    } catch (emailError) {
      console.error(
        "[LeadDocumentRequestUseCase][createRequest] Erro ao enviar e-mail:",
        emailError
      );
    }

    return new Output(true, ["Solicitação de documentos criada com sucesso."], [], request);
  }

  async resendEmail(requestId: string, teamId: string): Promise<Output> {
    const request = await prisma.leadDocumentRequest.findUnique({
      where: { id: requestId },
      select: {
        id: true,
        teamId: true,
        publicToken: true,
        message: true,
        items: { select: { name: true } },
        lead: { select: { name: true, email: true } },
        createdBy: { select: { fullName: true } },
      },
    });

    if (!request) {
      return new Output(false, [], ["Solicitação não encontrada."], null);
    }

    if (request.teamId !== teamId) {
      return new Output(false, [], ["Sem permissão para esta solicitação."], null);
    }

    if (!request.lead.email) {
      return new Output(false, [], ["O lead não possui e-mail cadastrado."], null);
    }

    const appUrl = getAppUrl();
    const publicUrl = `${appUrl}/documentos/${request.publicToken}`;
    const closerName = request.createdBy.fullName ?? "Corretor";

    await this.service.sendRequestEmail(request.lead.email, {
      closerName,
      leadName: request.lead.name,
      publicUrl,
      documents: request.items.map((item) => item.name),
      message: request.message ?? undefined,
    });

    await prisma.leadDocumentRequest.update({
      where: { id: requestId },
      data: { lastEmailSentAt: new Date() },
    });

    return new Output(true, ["E-mail reenviado com sucesso."], [], null);
  }

  async getPublicRequest(publicToken: string): Promise<Output> {
    const request = await prisma.leadDocumentRequest.findUnique({
      where: { publicToken },
      select: {
        id: true,
        publicToken: true,
        message: true,
        status: true,
        createdAt: true,
        items: {
          select: {
            id: true,
            name: true,
            description: true,
            isRequired: true,
            uploadedAt: true,
            attachmentId: true,
          },
        },
        lead: { select: { name: true } },
        createdBy: { select: { fullName: true } },
      },
    });

    if (!request) {
      return new Output(false, [], ["Solicitação não encontrada ou link inválido."], null);
    }

    return new Output(true, [], [], request);
  }

  async uploadItem(
    itemId: string,
    publicToken: string,
    file: UploadItemFile
  ): Promise<Output> {
    const item = await prisma.leadDocumentRequestItem.findUnique({
      where: { id: itemId },
      select: {
        id: true,
        uploadedAt: true,
        request: {
          select: {
            id: true,
            publicToken: true,
            teamId: true,
            leadId: true,
            createdByProfileId: true,
            status: true,
            items: { select: { id: true, attachmentId: true } },
          },
        },
      },
    });

    if (!item || item.request.publicToken !== publicToken) {
      return new Output(false, [], ["Item não encontrado ou link inválido."], null);
    }

    if (item.uploadedAt) {
      return new Output(false, [], ["Este documento já foi enviado."], null);
    }

    const supabase = createSupabaseAdmin();
    if (!supabase) {
      return new Output(false, [], ["Erro de configuração do servidor."], null);
    }

    const storagePath = `${item.request.leadId}/doc-requests/${item.request.id}/${Date.now()}-${file.fileName}`;

    const { error: uploadError } = await supabase.storage
      .from(STORAGE_BUCKETS.LEAD_ATTACHMENTS)
      .upload(storagePath, file.buffer, {
        contentType: file.fileType,
        upsert: false,
      });

    if (uploadError) {
      console.error("[LeadDocumentRequestUseCase][uploadItem] Erro no upload:", uploadError);
      return new Output(false, [], ["Falha ao fazer upload do arquivo. Tente novamente."], null);
    }

    const { data: urlData } = supabase.storage
      .from(STORAGE_BUCKETS.LEAD_ATTACHMENTS)
      .getPublicUrl(storagePath);

    const now = new Date();

    const attachment = await prisma.leadAttachment.create({
      data: {
        leadId: item.request.leadId,
        fileName: file.fileName,
        fileUrl: urlData.publicUrl,
        storagePath,
        fileType: file.fileType,
        fileSize: file.fileSize,
        uploadedBy: item.request.createdByProfileId,
        uploadedAt: now,
      },
    });

    await prisma.leadDocumentRequestItem.update({
      where: { id: itemId },
      data: { attachmentId: attachment.id, uploadedAt: now },
    });

    const allItems = item.request.items.map((i) =>
      i.id === itemId ? { ...i, attachmentId: attachment.id } : i
    );
    const uploadedCount = allItems.filter((i) => i.attachmentId !== null).length;
    const newStatus: "completed" | "partially_filled" =
      uploadedCount === allItems.length ? "completed" : "partially_filled";

    await prisma.leadDocumentRequest.update({
      where: { id: item.request.id },
      data: { status: newStatus },
    });

    try {
      await notificationService.createSystemNotification({
        recipientProfileId: item.request.createdByProfileId,
        teamId: item.request.teamId,
        message: "Um documento foi enviado na solicitação de documentos.",
        type: NotificationType.LEAD_DOCUMENT_UPLOADED,
      });
    } catch (notifError) {
      console.error(
        "[LeadDocumentRequestUseCase][uploadItem] Erro ao criar notificação:",
        notifError
      );
    }

    try {
      const [closer, lead] = await Promise.all([
        prisma.profile.findUnique({
          where: { id: item.request.createdByProfileId },
          select: { email: true, fullName: true },
        }),
        prisma.lead.findUnique({
          where: { id: item.request.leadId },
          select: { name: true },
        }),
      ]);

      if (closer?.email && lead) {
        const appUrl = getAppUrl();
        await this.service.sendUploadNotificationEmail(closer.email, {
          closerName: closer.fullName ?? "Corretor",
          leadName: lead.name,
          documentName: file.fileName,
          leadId: item.request.leadId,
          appUrl,
        });
      }
    } catch (emailError) {
      console.error(
        "[LeadDocumentRequestUseCase][uploadItem] Erro ao enviar e-mail de notificação:",
        emailError
      );
    }

    return new Output(true, ["Documento enviado com sucesso."], [], { attachmentId: attachment.id });
  }

  async processReminders(): Promise<Output> {
    const cutoffDate = new Date(Date.now() - TWO_DAYS_MS);

    const pendingRequests = await prisma.leadDocumentRequest.findMany({
      where: {
        status: { in: ["pending", "partially_filled"] },
        lastEmailSentAt: { lt: cutoffDate },
      },
      select: {
        id: true,
        publicToken: true,
        message: true,
        lead: { select: { email: true, name: true } },
        createdBy: { select: { fullName: true } },
        items: { select: { name: true } },
      },
    });

    console.info(
      `[LeadDocumentRequestUseCase][processReminders] Processando ${pendingRequests.length} solicitações`
    );

    const appUrl = getAppUrl();
    let successCount = 0;
    let errorCount = 0;

    for (const req of pendingRequests) {
      if (!req.lead.email) {
        continue;
      }

      const publicUrl = `${appUrl}/documentos/${req.publicToken}`;
      const closerName = req.createdBy.fullName ?? "Corretor";

      try {
        await this.service.sendRequestEmail(req.lead.email, {
          closerName,
          leadName: req.lead.name,
          publicUrl,
          documents: req.items.map((item) => item.name),
          message: req.message ?? undefined,
        });

        await prisma.leadDocumentRequest.update({
          where: { id: req.id },
          data: { lastEmailSentAt: new Date() },
        });

        successCount += 1;
      } catch (emailError) {
        console.error(
          `[LeadDocumentRequestUseCase][processReminders] Erro ao reenviar para ${req.id}:`,
          emailError
        );
        errorCount += 1;
      }
    }

    console.info(
      `[LeadDocumentRequestUseCase][processReminders] Concluído: ${successCount} enviados, ${errorCount} erros`
    );

    return new Output(
      true,
      [`${successCount} lembretes enviados, ${errorCount} erros`],
      [],
      { successCount, errorCount, total: pendingRequests.length }
    );
  }
}
