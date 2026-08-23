import type { Attachment } from "resend";
import { SupabaseStorageService, STORAGE_BUCKETS } from "@/lib/supabase/storage";
import { createSupabaseAdmin } from "@/lib/supabase/server";
import { leadAttachmentRepository } from "@/app/api/infra/data/repositories/leadAttachment/LeadAttachmentRepository";
import { AttachmentUploadResult } from "./DTOs/AttachmentUploadResult";
import { DeleteAttachmentResult } from "./DTOs/DeleteAttachmentResult";
import { ILeadAttachmentService } from "./ILeadAttachmentService";

/**
 * Upload/delete de anexos de lead via SupabaseStorageService (service-role).
 * Necessário para webhooks do bot (sem cookies de sessão) e alinhado ao path autenticado.
 */
export class LeadAttachmentService implements ILeadAttachmentService {
  /**
   * Faz upload de um attachment para o Supabase Storage
   * @param file - Arquivo
   * @param leadId - ID do lead
   * @param uploadedBy - ID do usuário que está fazendo upload (auditoria no use case)
   * @returns Resultado do upload
   */
  async uploadAttachment(
    file: File,
    leadId: string,
    _uploadedBy: string
  ): Promise<AttachmentUploadResult> {
    try {
      const result = await SupabaseStorageService.uploadFile(
        file,
        STORAGE_BUCKETS.LEAD_ATTACHMENTS,
        leadId,
        file.name,
        "attachment"
      );

      if (!result.success || !result.fileId || !result.publicUrl) {
        return { success: false, error: result.error ?? "Upload failed" };
      }

      return {
        success: true,
        fileId: result.fileId,
        publicUrl: result.publicUrl,
        fileName: file.name,
        fileType: file.type,
        fileSize: file.size,
      };
    } catch (error) {
      console.error("[LeadAttachmentService] Unexpected error during upload:", error);
      return { success: false, error: "Unexpected error during upload" };
    }
  }

  /**
   * Remove um attachment do Supabase Storage
   * @param fileId - ID do arquivo (caminho do arquivo)
   * @returns Sucesso ou erro
   */
  async deleteAttachment(fileId: string): Promise<DeleteAttachmentResult> {
    try {
      return await SupabaseStorageService.deleteFile(fileId, STORAGE_BUCKETS.LEAD_ATTACHMENTS);
    } catch (error) {
      console.error("[LeadAttachmentService] Unexpected error during deletion:", error);
      return { success: false, error: "Unexpected error during deletion" };
    }
  }

  /**
   * Obtém a URL pública de um attachment
   * @param fileId - ID do arquivo (caminho do arquivo)
   * @returns URL pública ou null
   */
  async getAttachmentUrl(fileId: string): Promise<string | null> {
    try {
      return SupabaseStorageService.getPublicUrl(fileId, STORAGE_BUCKETS.LEAD_ATTACHMENTS);
    } catch (error) {
      console.error("[LeadAttachmentService] Error getting attachment URL:", error);
      return null;
    }
  }

  /**
   * Lista todos os attachments de um lead
   * @param leadId - ID do lead
   * @returns Lista de arquivos
   */
  async listLeadAttachments(leadId: string): Promise<string[]> {
    try {
      const result = await SupabaseStorageService.listFiles(
        leadId,
        STORAGE_BUCKETS.LEAD_ATTACHMENTS
      );

      if (!result.success || !result.files) {
        return [];
      }

      return result.files.map((file) => `${leadId}/${file.name}`);
    } catch (error) {
      console.error("[LeadAttachmentService] Unexpected error listing attachments:", error);
      return [];
    }
  }

  async buildProposalAttachments(leadId: string): Promise<Attachment[]> {
    const leadAttachments = await leadAttachmentRepository.findDownloadRefsByLeadId(leadId);

    if (leadAttachments.length === 0) {
      return [];
    }

    const supabaseAdmin = createSupabaseAdmin();

    const downloads = await Promise.all(
      leadAttachments.map(async (leadAttachment) => {
        try {
          let buffer: Buffer | null = null;

          const storagePath = leadAttachment.storagePath?.trim();
          if (supabaseAdmin && storagePath) {
            const { data, error } = await supabaseAdmin.storage
              .from(STORAGE_BUCKETS.LEAD_ATTACHMENTS)
              .download(storagePath);

            if (error) {
              console.error("Erro ao baixar anexo do storage para e-mail:", {
                leadId,
                attachmentId: leadAttachment.id,
                storagePath,
                error,
              });
            } else if (data) {
              buffer = Buffer.from(await data.arrayBuffer());
            }
          }

          if (!buffer && leadAttachment.fileUrl) {
            const response = await fetch(leadAttachment.fileUrl);
            if (!response.ok) {
              throw new Error(`Falha ao baixar arquivo via URL pública: ${response.status}`);
            }

            const arrayBuffer = await response.arrayBuffer();
            buffer = Buffer.from(arrayBuffer);
          }

          if (!buffer) return null;

          return {
            filename: leadAttachment.fileName || `documento-${leadAttachment.id}`,
            content: buffer,
            ...(leadAttachment.fileType ? { contentType: leadAttachment.fileType } : {}),
          } as Attachment;
        } catch (error) {
          console.error("Erro ao preparar anexo de lead para e-mail:", {
            leadId,
            attachmentId: leadAttachment.id,
            error,
          });
          return null;
        }
      })
    );

    return downloads.filter((a): a is Attachment => a !== null);
  }
}

export const leadAttachmentService = new LeadAttachmentService();
