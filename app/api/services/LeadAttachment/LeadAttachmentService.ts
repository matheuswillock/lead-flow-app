import { createSupabaseServer } from "@/lib/supabase/server";
import { AttachmentUploadResult } from "./DTOs/AttachmentUploadResult";
import { DeleteAttachmentResult } from "./DTOs/DeleteAttachmentResult";
import { ILeadAttachmentService } from "./ILeadAttachmentService";

export class LeadAttachmentService implements ILeadAttachmentService {
  private readonly BUCKET_NAME = "lead-attachments";
  private readonly MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
  private readonly ALLOWED_TYPES = [
    // Imagens
    "image/jpeg",
    "image/jpg",
    "image/png",
    "image/webp",
    "image/gif",
    // PDFs
    "application/pdf",
    // Documentos
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.ms-excel",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    // Texto
    "text/plain",
    "text/csv",
  ];

  /**
   * Faz upload de um attachment para o Supabase Storage
   * @param file - Arquivo
   * @param leadId - ID do lead
   * @param uploadedBy - ID do usuário que está fazendo upload
   * @returns Resultado do upload
   */
  async uploadAttachment(
    file: File,
    leadId: string,
    _uploadedBy: string
  ): Promise<AttachmentUploadResult> {
    try {
      // Validações
      const validation = this.validateFile(file);
      if (!validation.isValid) {
        return { success: false, error: validation.error };
      }

      const supabase = await createSupabaseServer();
      if (!supabase) {
        return { success: false, error: "Failed to initialize Supabase client" };
      }

      // Gerar nome único para o arquivo mantendo nome original
      const timestamp = Date.now();
      const randomStr = Math.random().toString(36).substring(2, 8);
      const sanitizedFileName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
      const fileName = `${leadId}/${timestamp}-${randomStr}-${sanitizedFileName}`;

      // Converter File para ArrayBuffer
      const arrayBuffer = await file.arrayBuffer();
      const uint8Array = new Uint8Array(arrayBuffer);

      // Upload para o Supabase Storage
      const { data: uploadData, error } = await supabase.storage
        .from(this.BUCKET_NAME)
        .upload(fileName, uint8Array, {
          contentType: file.type,
          cacheControl: "3600",
          upsert: false,
        });

      if (error) {
        console.error("Error uploading file to Supabase Storage:", error);
        return { success: false, error: `Upload failed: ${error.message}` };
      }

      if (!uploadData) {
        return { success: false, error: "Upload succeeded but no data returned" };
      }

      // Obter URL pública
      const { data: urlData } = supabase.storage
        .from(this.BUCKET_NAME)
        .getPublicUrl(fileName);

      return {
        success: true,
        fileId: fileName,
        publicUrl: urlData.publicUrl,
        fileName: file.name,
        fileType: file.type,
        fileSize: file.size,
      };
    } catch (error) {
      console.error("Unexpected error during file upload:", error);
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
      const supabase = await createSupabaseServer();
      if (!supabase) {
        return { success: false, error: "Failed to initialize Supabase client" };
      }

      const { error } = await supabase.storage.from(this.BUCKET_NAME).remove([fileId]);

      if (error) {
        console.error("Error deleting file from Supabase Storage:", error);
        return { success: false, error: `Delete failed: ${error.message}` };
      }

      return { success: true };
    } catch (error) {
      console.error("Unexpected error during file deletion:", error);
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
      const supabase = await createSupabaseServer();
      if (!supabase) return null;

      const { data } = supabase.storage.from(this.BUCKET_NAME).getPublicUrl(fileId);

      return data.publicUrl;
    } catch (error) {
      console.error("Error getting attachment URL:", error);
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
      const supabase = await createSupabaseServer();
      if (!supabase) return [];

      const { data, error } = await supabase.storage.from(this.BUCKET_NAME).list(leadId, {
        limit: 100,
        offset: 0,
        sortBy: { column: "created_at", order: "desc" },
      });

      if (error || !data) {
        console.error("Error listing lead attachments:", error);
        return [];
      }

      return data.map((file) => `${leadId}/${file.name}`);
    } catch (error) {
      console.error("Unexpected error listing lead attachments:", error);
      return [];
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
        error: "File type not allowed. Accepted: images, PDFs, Word, Excel, text files",
      };
    }

    // Verificar se o arquivo não está vazio
    if (file.size === 0) {
      return { isValid: false, error: "File cannot be empty" };
    }

    return { isValid: true };
  }
}

export const leadAttachmentService = new LeadAttachmentService();
