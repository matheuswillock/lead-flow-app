import { SupabaseStorageService, STORAGE_BUCKETS } from "@/lib/supabase/storage";
import { LeadAttachmentUploadResult } from "./DTOs/LeadAttachmentUploadResult";
import { DeleteLeadAttachmentResult } from "./DTOs/DeleteLeadAttachmentResult";
import { ILeadAttachmentService } from "./ILeadAttachmentService";

/**
 * Service para gerenciamento de anexos de leads
 * Utiliza SupabaseStorageService para operações de storage
 */
export class LeadAttachmentService implements ILeadAttachmentService {
  /**
   * Faz upload de um anexo para o Supabase Storage
   * @param file - Arquivo a ser enviado
   * @param leadId - ID do lead
   * @param fileName - Nome do arquivo original
   * @returns Resultado do upload
   */
  async uploadAttachment(
    file: File,
    leadId: string,
    fileName: string
  ): Promise<LeadAttachmentUploadResult> {
    try {
      // Usar SupabaseStorageService para upload
      const result = await SupabaseStorageService.uploadFile(
        file,
        STORAGE_BUCKETS.LEAD_ATTACHMENTS,
        leadId,
        fileName,
        'attachment'
      );

      if (!result.success) {
        return { success: false, error: result.error };
      }

      return {
        success: true,
        attachmentId: result.fileId,
        publicUrl: result.publicUrl,
      };
    } catch (error) {
      console.error("[LeadAttachmentService] Unexpected error during upload:", error);
      return { success: false, error: "Unexpected error during upload" };
    }
  }

  /**
   * Remove um anexo do Supabase Storage
   * @param attachmentId - ID do anexo (caminho do arquivo)
   * @returns Sucesso ou erro
   */
  async deleteAttachment(attachmentId: string): Promise<DeleteLeadAttachmentResult> {
    try {
      // Usar SupabaseStorageService para delete
      const result = await SupabaseStorageService.deleteFile(
        attachmentId,
        STORAGE_BUCKETS.LEAD_ATTACHMENTS
      );

      return result;
    } catch (error) {
      console.error("[LeadAttachmentService] Unexpected error during deletion:", error);
      return { success: false, error: "Unexpected error during deletion" };
    }
  }

  /**
   * Obtém a URL pública de um anexo
   * @param attachmentId - ID do anexo (caminho do arquivo)
   * @returns URL pública ou null
   */
  async getAttachmentUrl(attachmentId: string): Promise<string | null> {
    try {
      // Usar SupabaseStorageService para obter URL
      return SupabaseStorageService.getPublicUrl(attachmentId, STORAGE_BUCKETS.LEAD_ATTACHMENTS);
    } catch (error) {
      console.error("[LeadAttachmentService] Error getting attachment URL:", error);
      return null;
    }
  }

  /**
   * Lista todos os anexos de um lead
   * @param leadId - ID do lead
   * @returns Lista de arquivos
   */
  async listLeadAttachments(leadId: string): Promise<string[]> {
    try {
      // Usar SupabaseStorageService para listar arquivos
      const result = await SupabaseStorageService.listFiles(
        leadId,
        STORAGE_BUCKETS.LEAD_ATTACHMENTS
      );

      if (!result.success || !result.files) {
        return [];
      }

      return result.files.map(file => `${leadId}/${file.name}`);
    } catch (error) {
      console.error("[LeadAttachmentService] Unexpected error listing attachments:", error);
      return [];
    }
  }
}

export const leadAttachmentService = new LeadAttachmentService();
