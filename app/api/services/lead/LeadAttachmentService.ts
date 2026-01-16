import { createSupabaseServer, createSupabaseAdmin } from "@/lib/supabase/server";
import { LeadAttachmentUploadResult } from "./DTOs/LeadAttachmentUploadResult";
import { DeleteLeadAttachmentResult } from "./DTOs/DeleteLeadAttachmentResult";
import { ILeadAttachmentService } from "./ILeadAttachmentService";

export class LeadAttachmentService implements ILeadAttachmentService {
  private readonly BUCKET_NAME = process.env.SUPABASE_LEAD_ATTACHMENTS_BUCKET || "";
  private readonly MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
  private readonly ALLOWED_TYPES = [
    // Documentos
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.ms-excel",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    // Imagens
    "image/jpeg",
    "image/png",
    "image/webp",
    "image/gif",
    // Outros
    "text/plain",
  ];

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
      // Validações
      const validation = this.validateFile(file);
      if (!validation.isValid) {
        return { success: false, error: validation.error };
      }

      // Usar Admin client para bypass RLS
      const supabase = createSupabaseAdmin();
      if (!supabase) {
        return { success: false, error: "Failed to initialize Supabase client" };
      }

      // Gerar nome único para o arquivo mantendo a extensão original
      const fileExtension = fileName.split('.').pop()?.toLowerCase() || 'bin';
      const timestamp = Date.now();
      const randomStr = Math.random().toString(36).substring(2, 8);
      const uniqueFileName = `${leadId}/${timestamp}-${randomStr}.${fileExtension}`;

      // Converter File para ArrayBuffer
      const arrayBuffer = await file.arrayBuffer();
      const uint8Array = new Uint8Array(arrayBuffer);

      // Upload para o Supabase Storage
      const { data: uploadData, error } = await supabase.storage
        .from(this.BUCKET_NAME)
        .upload(uniqueFileName, uint8Array, {
          contentType: file.type,
          cacheControl: '3600',
          upsert: false
        });

      if (error) {
        console.error("Error uploading attachment to Supabase Storage:", error);
        return { success: false, error: `Upload failed: ${error.message}` };
      }

      if (!uploadData) {
        return { success: false, error: "Upload succeeded but no data returned" };
      }

      // Obter URL pública
      const { data: urlData } = supabase.storage
        .from(this.BUCKET_NAME)
        .getPublicUrl(uniqueFileName);

      return {
        success: true,
        attachmentId: uniqueFileName,
        publicUrl: urlData.publicUrl
      };
    } catch (error) {
      console.error("Unexpected error during attachment upload:", error);
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
      // Usar Admin client para bypass RLS
      const supabase = createSupabaseAdmin();
      if (!supabase) {
        return { success: false, error: "Failed to initialize Supabase client" };
      }

      const { error } = await supabase.storage
        .from(this.BUCKET_NAME)
        .remove([attachmentId]);

      if (error) {
        console.error("Error deleting attachment from Supabase Storage:", error);
        return { success: false, error: `Delete failed: ${error.message}` };
      }

      return { success: true };
    } catch (error) {
      console.error("Unexpected error during attachment deletion:", error);
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
      // Usar Admin client para bypass RLS
      const supabase = createSupabaseAdmin();
      if (!supabase) return null;

      const { data } = supabase.storage
        .from(this.BUCKET_NAME)
        .getPublicUrl(attachmentId);

      return data.publicUrl;
    } catch (error) {
      console.error("Error getting attachment URL:", error);
      return null;
    }
  }

  /**
   * Valida arquivo de upload
   * @param file - Arquivo a ser validado
   * @returns Resultado da validação
   */
  private validateFile(file: File): { isValid: boolean; error?: string } {
    // Verificar tamanho
    if (file.size > this.MAX_FILE_SIZE) {
      return { isValid: false, error: "File size must be less than 10MB" };
    }

    // Verificar tipo MIME
    if (!this.ALLOWED_TYPES.includes(file.type)) {
      return {
        isValid: false,
        error: "File type not allowed. Supported: PDF, Word, Excel, Images, Text"
      };
    }

    // Verificar se o arquivo não está vazio
    if (file.size === 0) {
      return { isValid: false, error: "File cannot be empty" };
    }

    return { isValid: true };
  }

  /**
   * Lista todos os anexos de um lead
   * @param leadId - ID do lead
   * @returns Lista de arquivos
   */
  async listLeadAttachments(leadId: string): Promise<string[]> {
    try {
      // Usar Admin client para bypass RLS
      const supabase = createSupabaseAdmin();
      if (!supabase) return [];

      const { data, error } = await supabase.storage
        .from(this.BUCKET_NAME)
        .list(leadId, {
          limit: 100,
          offset: 0,
          sortBy: { column: 'created_at', order: 'desc' }
        });

      if (error || !data) {
        console.error("Error listing lead attachments:", error);
        return [];
      }

      return data.map(file => `${leadId}/${file.name}`);
    } catch (error) {
      console.error("Unexpected error listing lead attachments:", error);
      return [];
    }
  }
}

export const leadAttachmentService = new LeadAttachmentService();
