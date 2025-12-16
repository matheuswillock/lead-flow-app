import { Output } from "@/lib/output";
import { ILeadAttachmentUseCase } from "./ILeadAttachmentUseCase";
import { leadAttachmentService } from "@/app/api/services/LeadAttachment/LeadAttachmentService";
import { prisma } from "@/app/api/infra/data/prisma";

export class LeadAttachmentUseCase implements ILeadAttachmentUseCase {
  /**
   * Faz upload de um attachment e salva no banco de dados
   */
  async uploadAttachment(leadId: string, file: File, uploadedBy: string): Promise<Output> {
    try {
      // Validar se o lead existe
      const lead = await prisma.lead.findUnique({
        where: { id: leadId },
      });

      if (!lead) {
        return new Output(false, [], ["Lead not found"], null);
      }

      // Validar se o usuário existe
      const user = await prisma.profile.findUnique({
        where: { id: uploadedBy },
      });

      if (!user) {
        return new Output(false, [], ["User not found"], null);
      }

      // Upload do arquivo para o Supabase Storage
      const uploadResult = await leadAttachmentService.uploadAttachment(file, leadId, uploadedBy);

      if (!uploadResult.success || !uploadResult.fileId || !uploadResult.publicUrl) {
        return new Output(false, [], [uploadResult.error || "Upload failed"], null);
      }

      // Salvar registro no banco de dados
      const attachment = await prisma.leadAttachment.create({
        data: {
          leadId,
          fileName: uploadResult.fileName || file.name,
          fileUrl: uploadResult.publicUrl,
          fileType: uploadResult.fileType || file.type,
          fileSize: uploadResult.fileSize || file.size,
          uploadedBy,
        },
        include: {
          uploader: {
            select: {
              id: true,
              fullName: true,
              email: true,
            },
          },
        },
      });

      return new Output(true, ["File uploaded successfully"], [], attachment);
    } catch (error) {
      console.error("Error uploading attachment:", error);
      return new Output(false, [], ["Internal server error"], null);
    }
  }

  /**
   * Deleta um attachment do storage e do banco de dados
   */
  async deleteAttachment(attachmentId: string, leadId: string): Promise<Output> {
    try {
      // Buscar attachment no banco
      const attachment = await prisma.leadAttachment.findUnique({
        where: { id: attachmentId },
      });

      if (!attachment) {
        return new Output(false, [], ["Attachment not found"], null);
      }

      // Verificar se o attachment pertence ao lead
      if (attachment.leadId !== leadId) {
        return new Output(false, [], ["Attachment does not belong to this lead"], null);
      }

      // Extrair o fileId do URL ou usar o campo adequado
      // O fileId é o caminho do arquivo no bucket: "leadId/timestamp-random-filename"
      const fileId = attachment.fileUrl.split("/").slice(-2).join("/");

      // Deletar do Supabase Storage
      const deleteResult = await leadAttachmentService.deleteAttachment(fileId);

      if (!deleteResult.success) {
        // Mesmo se falhar no storage, continuar para deletar do banco
        console.warn("Failed to delete from storage, but continuing:", deleteResult.error);
      }

      // Deletar do banco de dados
      await prisma.leadAttachment.delete({
        where: { id: attachmentId },
      });

      return new Output(true, ["Attachment deleted successfully"], [], null);
    } catch (error) {
      console.error("Error deleting attachment:", error);
      return new Output(false, [], ["Internal server error"], null);
    }
  }

  /**
   * Lista todos os attachments de um lead
   */
  async listAttachments(leadId: string): Promise<Output> {
    try {
      // Verificar se o lead existe
      const lead = await prisma.lead.findUnique({
        where: { id: leadId },
      });

      if (!lead) {
        return new Output(false, [], ["Lead not found"], null);
      }

      // Buscar attachments do lead
      const attachments = await prisma.leadAttachment.findMany({
        where: { leadId },
        include: {
          uploader: {
            select: {
              id: true,
              fullName: true,
              email: true,
            },
          },
        },
        orderBy: {
          uploadedAt: "desc",
        },
      });

      return new Output(true, [], [], attachments);
    } catch (error) {
      console.error("Error listing attachments:", error);
      return new Output(false, [], ["Internal server error"], null);
    }
  }
}

export const leadAttachmentUseCase = new LeadAttachmentUseCase();
