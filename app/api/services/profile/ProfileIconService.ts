import { SupabaseStorageService, STORAGE_BUCKETS } from "@/lib/supabase/storage";
import { ProfileIconUploadResult } from "./DTOs/ProfileIconUploadResult";
import { DeleteProfileIconResult } from "./DTOs/DeleteProfileIconResult";
import { IProfileIconService } from "./IProfileIconService";

/**
 * Service para gerenciamento de ícones de perfil
 * Utiliza SupabaseStorageService para operações de storage
 */
export class ProfileIconService implements IProfileIconService {
  /**
   * Faz upload de um ícone de perfil para o Supabase Storage
   * @param file - Arquivo de imagem
   * @param userId - ID do usuário (supabaseId)
   * @returns Resultado do upload
   */
  async uploadProfileIcon(file: File, userId: string): Promise<ProfileIconUploadResult> {
    try {
      // Usar SupabaseStorageService para upload
      const result = await SupabaseStorageService.uploadFile(
        file,
        STORAGE_BUCKETS.PROFILE_ICONS,
        userId,
        file.name,
        'icon'
      );

      if (!result.success) {
        return { success: false, error: result.error };
      }

      return {
        success: true,
        iconId: result.fileId,
        publicUrl: result.publicUrl,
      };
    } catch (error) {
      console.error("[ProfileIconService] Unexpected error during upload:", error);
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
      // Usar SupabaseStorageService para delete
      const result = await SupabaseStorageService.deleteFile(
        iconId,
        STORAGE_BUCKETS.PROFILE_ICONS
      );

      return result;
    } catch (error) {
      console.error("[ProfileIconService] Unexpected error during deletion:", error);
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
      // Usar SupabaseStorageService para obter URL
      return SupabaseStorageService.getPublicUrl(iconId, STORAGE_BUCKETS.PROFILE_ICONS);
    } catch (error) {
      console.error("[ProfileIconService] Error getting profile icon URL:", error);
      return null;
    }
  }

  /**
   * Lista todos os ícones de um usuário (para limpeza)
   * @param userId - ID do usuário
   * @returns Lista de arquivos
   */
  async listUserIcons(userId: string): Promise<string[]> {
    try {
      // Usar SupabaseStorageService para listar arquivos
      const result = await SupabaseStorageService.listFiles(
        userId,
        STORAGE_BUCKETS.PROFILE_ICONS
      );

      if (!result.success || !result.files) {
        return [];
      }

      return result.files.map(file => `${userId}/${file.name}`);
    } catch (error) {
      console.error("[ProfileIconService] Unexpected error listing user icons:", error);
      return [];
    }
  }
}

export const profileIconService = new ProfileIconService();
