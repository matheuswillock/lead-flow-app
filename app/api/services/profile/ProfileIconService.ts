import { createSupabaseServer } from "@/lib/supabase/server";
import { ProfileIconUploadResult } from "./DTOs/ProfileIconUploadResult";
import { DeleteProfileIconResult } from "./DTOs/DeleteProfileIconResult";
import { IProfileIconService } from "./IProfileIconService";

// TODO: Implementar em uma usecase a service não deve ser chamada diretamente por controllers
export class ProfileIconService implements IProfileIconService {
  private readonly BUCKET_NAME = "profile-icons";
  private readonly MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
  private readonly ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];

  /**
   * Faz upload de um ícone de perfil para o Supabase Storage
   * @param file - Arquivo de imagem
   * @param userId - ID do usuário (supabaseId)
   * @returns Resultado do upload
   */
  async uploadProfileIcon(file: File, userId: string): Promise<ProfileIconUploadResult> {
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

      // Gerar nome único para o arquivo
      const fileExtension = file.name.split('.').pop()?.toLowerCase() || 'png';
      const fileName = `${userId}/${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExtension}`;

      // Converter File para ArrayBuffer
      const arrayBuffer = await file.arrayBuffer();
      const uint8Array = new Uint8Array(arrayBuffer);

      // Upload para o Supabase Storage
      const { data: uploadData, error } = await supabase.storage
        .from(this.BUCKET_NAME)
        .upload(fileName, uint8Array, {
          contentType: file.type,
          cacheControl: '3600',
          upsert: false
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
        iconId: fileName,
        publicUrl: urlData.publicUrl
      };
    } catch (error) {
      console.error("Unexpected error during file upload:", error);
      return { success: false, error: "Unexpected error during upload" };
    }
  }

  /**
   * Remove um ícone de perfil do Supabase Storage
   * @param iconId - ID do ícone (caminho do arquivo)
   * @returns Sucesso ou erro
   */
  async deleteProfileIcon(iconId: string): Promise<DeleteProfileIconResult> {
    try {
      const supabase = await createSupabaseServer();
      if (!supabase) {
        return { success: false, error: "Failed to initialize Supabase client" };
      }

      const { error } = await supabase.storage
        .from(this.BUCKET_NAME)
        .remove([iconId]);

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
   * Obtém a URL pública de um ícone de perfil
   * @param iconId - ID do ícone (caminho do arquivo)
   * @returns URL pública ou null
   */
  async getProfileIconUrl(iconId: string): Promise<string | null> {
    try {
      const supabase = await createSupabaseServer();
      if (!supabase) return null;

      const { data } = supabase.storage
        .from(this.BUCKET_NAME)
        .getPublicUrl(iconId);

      return data.publicUrl;
    } catch (error) {
      console.error("Error getting profile icon URL:", error);
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
      return { isValid: false, error: "File size must be less than 5MB" };
    }

    // Verificar tipo MIME
    if (!this.ALLOWED_TYPES.includes(file.type)) {
      return { isValid: false, error: "File type must be JPEG, PNG, WebP, or GIF" };
    }

    // Verificar se o arquivo não está vazio
    if (file.size === 0) {
      return { isValid: false, error: "File cannot be empty" };
    }

    return { isValid: true };
  }

  /**
   * Lista todos os ícones de um usuário (para limpeza)
   * @param userId - ID do usuário
   * @returns Lista de arquivos
   */
  async listUserIcons(userId: string): Promise<string[]> {
    try {
      const supabase = await createSupabaseServer();
      if (!supabase) return [];

      const { data, error } = await supabase.storage
        .from(this.BUCKET_NAME)
        .list(userId, {
          limit: 100,
          offset: 0
        });

      if (error || !data) {
        console.error("Error listing user icons:", error);
        return [];
      }

      return data.map(file => `${userId}/${file.name}`);
    } catch (error) {
      console.error("Unexpected error listing user icons:", error);
      return [];
    }
  }
}

export const profileIconService = new ProfileIconService();