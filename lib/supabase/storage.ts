/**
 * 🗄️ Supabase Storage Service
 * 
 * Biblioteca centralizada para gerenciamento de uploads no Supabase Storage.
 * Responsável por:
 * - Configurações de buckets
 * - Validações de arquivos
 * - Upload/Delete de arquivos
 * - Geração de URLs públicas
 * - Tratamento padronizado de erros
 */

import { createSupabaseAdmin } from "./server";

// ============================================
// CONFIGURAÇÕES DE BUCKETS
// ============================================

export const STORAGE_BUCKETS = {
  LEAD_ATTACHMENTS: process.env.SUPABASE_LEAD_ATTACHMENTS_BUCKET || "lead-attachments",
  PROFILE_ICONS: process.env.SUPABASE_PROFILE_ICONS_BUCKET || "profile-icons",
  EMAIL_TEMPLATE_ASSETS:
    process.env.SUPABASE_EMAIL_TEMPLATE_ASSETS_BUCKET || "email-template-assets",
  CONTRACTS: process.env.SUPABASE_CONTRACTS_BUCKET || "backoffice-contracts",
  SUPPORT_REQUEST_ATTACHMENTS:
    process.env.SUPABASE_SUPPORT_ATTACHMENTS_BUCKET || "support-request-attachments",
} as const;

export type BucketName = typeof STORAGE_BUCKETS[keyof typeof STORAGE_BUCKETS];

// ============================================
// CONFIGURAÇÕES DE VALIDAÇÃO
// ============================================

interface BucketConfig {
  maxFileSize: number; // em bytes
  allowedTypes: string[];
  description: string;
}

const BUCKET_CONFIGS: Record<BucketName, BucketConfig> = {
  [STORAGE_BUCKETS.LEAD_ATTACHMENTS]: {
    maxFileSize: 10 * 1024 * 1024, // 10MB
    allowedTypes: [
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
    ],
    description: "Anexos de leads (PDFs, DOCs, imagens)",
  },
  [STORAGE_BUCKETS.PROFILE_ICONS]: {
    maxFileSize: 5 * 1024 * 1024, // 5MB
    allowedTypes: [
      "image/jpeg",
      "image/png",
      "image/webp",
      "image/gif",
    ],
    description: "Ícones de perfil de usuários",
  },
  [STORAGE_BUCKETS.EMAIL_TEMPLATE_ASSETS]: {
    maxFileSize: 2 * 1024 * 1024, // 2MB
    allowedTypes: ["image/jpeg", "image/png", "image/webp"],
    description: "Imagens PNG/JPG para templates de e-mail",
  },
  [STORAGE_BUCKETS.CONTRACTS]: {
    maxFileSize: 10 * 1024 * 1024, // 10MB
    allowedTypes: ["application/pdf"],
    description: "PDFs de contratos do backoffice (bucket privado)",
  },
  [STORAGE_BUCKETS.SUPPORT_REQUEST_ATTACHMENTS]: {
    maxFileSize: 5 * 1024 * 1024, // 5MB
    allowedTypes: ["image/jpeg", "image/png", "image/webp", "image/gif"],
    description: "Imagens anexadas a pedidos de suporte (bucket privado)",
  },
};

// ============================================
// TIPOS DE RETORNO
// ============================================

export interface StorageUploadResult {
  success: boolean;
  fileId?: string;
  publicUrl?: string;
  error?: string;
}

export interface StorageDeleteResult {
  success: boolean;
  error?: string;
}

export interface FileValidationResult {
  isValid: boolean;
  error?: string;
}

// ============================================
// MAPEAMENTO DE ERROS
// ============================================

/**
 * Mapeia erros do Supabase Storage para mensagens amigáveis ao usuário
 */
export class StorageErrorMapper {
  private static readonly ERROR_MESSAGES: Record<string, string> = {
    // Erros de permissão
    "new row violates row-level security policy": "Você não tem permissão para fazer upload deste arquivo",
    "permission denied": "Você não tem permissão para acessar este arquivo",
    "unauthorized": "Você precisa estar autenticado para realizar esta ação",
    
    // Erros de bucket
    "Bucket not found": "Erro de configuração: bucket de storage não encontrado",
    "bucket does not exist": "Erro de configuração: bucket de storage não existe",
    
    // Erros de arquivo
    "file already exists": "Um arquivo com este nome já existe",
    "file not found": "Arquivo não encontrado",
    "The resource already exists": "Este arquivo já existe no sistema",
    
    // Erros de tamanho
    "payload too large": "Arquivo muito grande para upload",
    "entity too large": "Arquivo muito grande para upload",
    
    // Erros de rede
    "network error": "Erro de conexão. Verifique sua internet e tente novamente",
    "fetch failed": "Falha na conexão. Tente novamente",
    "timeout": "Tempo limite excedido. Tente novamente",
    
    // Erros de quota
    "quota exceeded": "Limite de armazenamento atingido",
    "storage quota exceeded": "Limite de armazenamento atingido",
  };

  /**
   * Mapeia um erro para uma mensagem amigável
   */
  static mapError(error: unknown): string {
    // Log do erro original para monitoramento
    console.error('[StorageErrorMapper] Mapeando erro:', error);
    
    // Se já é uma string, tentar mapear
    if (typeof error === 'string') {
      return this.findMappedMessage(error);
    }

    // Se é um objeto de erro do Supabase
    if (error && typeof error === 'object') {
      const err = error as any;
      
      // Tentar pegar a mensagem de erro
      const errorMessage = err.message || err.error || err.msg || '';
      
      if (errorMessage) {
        return this.findMappedMessage(errorMessage);
      }
    }

    // Mensagem genérica para erros não mapeados
    console.warn('[StorageErrorMapper] Erro não mapeado detectado:', error);
    return "Ocorreu um erro ao processar o arquivo. Tente novamente";
  }

  /**
   * Procura uma mensagem mapeada baseada no erro
   */
  private static findMappedMessage(errorText: string): string {
    const lowerError = errorText.toLowerCase();
    
    // Procurar por correspondência exata ou parcial
    for (const [key, message] of Object.entries(this.ERROR_MESSAGES)) {
      if (lowerError.includes(key.toLowerCase())) {
        return message;
      }
    }

    // Se não encontrou mapeamento, retornar mensagem genérica
    return "Ocorreu um erro ao processar o arquivo. Tente novamente";
  }

  /**
   * Adiciona contexto adicional à mensagem de erro
   */
  static mapErrorWithContext(error: unknown, context: string): string {
    const baseMessage = this.mapError(error);
    return `${context}: ${baseMessage}`;
  }
}

// ============================================
// CLASSE PRINCIPAL: SupabaseStorageService
// ============================================

export class SupabaseStorageService {
  /**
   * Valida um arquivo baseado nas configurações do bucket
   */
  static validateFile(file: File, bucketName: BucketName): FileValidationResult {
    const config = BUCKET_CONFIGS[bucketName];

    if (!config) {
      return {
        isValid: false,
        error: `Bucket '${bucketName}' não configurado`,
      };
    }

    // Validar tamanho
    if (file.size > config.maxFileSize) {
      const maxSizeMB = (config.maxFileSize / 1024 / 1024).toFixed(2);
      return {
        isValid: false,
        error: `Arquivo muito grande. Tamanho máximo: ${maxSizeMB}MB`,
      };
    }

    // Validar tipo
    if (!config.allowedTypes.includes(file.type)) {
      return {
        isValid: false,
        error: `Tipo de arquivo não permitido. Tipos aceitos: ${config.allowedTypes.join(", ")}`,
      };
    }

    return { isValid: true };
  }

  /**
   * Gera um nome único para o arquivo
   */
  static generateUniqueFileName(
    originalFileName: string,
    entityId: string,
    prefix?: string
  ): string {
    const fileExtension = originalFileName.split('.').pop()?.toLowerCase() || 'bin';
    const timestamp = Date.now();
    const randomStr = Math.random().toString(36).substring(2, 8);
    
    const prefixPart = prefix ? `${prefix}-` : '';
    return `${entityId}/${prefixPart}${timestamp}-${randomStr}.${fileExtension}`;
  }

  /**
   * Faz upload de um arquivo para o Supabase Storage
   * 
   * @param file - Arquivo a ser enviado
   * @param bucketName - Nome do bucket (usar STORAGE_BUCKETS)
   * @param entityId - ID da entidade (leadId, userId, etc)
   * @param originalFileName - Nome original do arquivo
   * @param prefix - Prefixo opcional para o nome do arquivo
   * @returns Resultado do upload com fileId e publicUrl
   */
  static async uploadFile(
    file: File,
    bucketName: BucketName,
    entityId: string,
    originalFileName: string,
    prefix?: string
  ): Promise<StorageUploadResult> {
    try {
      // 1. Validar arquivo
      const validation = this.validateFile(file, bucketName);
      if (!validation.isValid) {
        console.error('[SupabaseStorageService.uploadFile] Validação falhou:', {
          bucketName,
          fileName: originalFileName,
          fileSize: file.size,
          fileType: file.type,
          error: validation.error
        });
        return { success: false, error: validation.error };
      }

      // 2. Obter cliente Admin (bypass RLS)
      const supabase = createSupabaseAdmin();
      if (!supabase) {
        console.error('[SupabaseStorageService.uploadFile] Falha ao inicializar cliente Supabase:', {
          bucketName,
          entityId
        });
        return { success: false, error: "Failed to initialize Supabase client" };
      }

      // 3. Gerar nome único
      const uniqueFileName = this.generateUniqueFileName(
        originalFileName,
        entityId,
        prefix
      );

      // 4. Converter File para Uint8Array
      const arrayBuffer = await file.arrayBuffer();
      const uint8Array = new Uint8Array(arrayBuffer);

      // 5. Upload para o Storage
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from(bucketName)
        .upload(uniqueFileName, uint8Array, {
          contentType: file.type,
          cacheControl: '3600',
          upsert: false,
        });

      if (uploadError) {
        console.error('[SupabaseStorageService.uploadFile] Erro no upload para Supabase:', {
          bucketName,
          fileName: originalFileName,
          uniqueFileName,
          fileSize: file.size,
          fileType: file.type,
          entityId,
          error: uploadError
        });
        const mappedError = StorageErrorMapper.mapError(uploadError);
        return { success: false, error: mappedError };
      }

      if (!uploadData) {
        return { success: false, error: "Não foi possível completar o upload. Tente novamente" };
      }

      // 6. Obter URL pública
      const { data: urlData } = supabase.storage
        .from(bucketName)
        .getPublicUrl(uniqueFileName);

      return {
        success: true,
        fileId: uniqueFileName,
        publicUrl: urlData.publicUrl,
      };
    } catch (error) {
      console.error('[SupabaseStorageService.uploadFile] Erro inesperado:', {
        bucketName,
        fileName: originalFileName,
        entityId,
        error
      });
      const mappedError = StorageErrorMapper.mapError(error);
      return { success: false, error: mappedError };
    }
  }

  /**
   * Remove um arquivo do Supabase Storage
   * 
   * @param fileId - ID do arquivo (caminho completo)
   * @param bucketName - Nome do bucket
   * @returns Resultado da deleção
   */
  static async deleteFile(
    fileId: string,
    bucketName: BucketName
  ): Promise<StorageDeleteResult> {
    try {
      // 1. Obter cliente Admin (bypass RLS)
      const supabase = createSupabaseAdmin();
      if (!supabase) {
        console.error('[SupabaseStorageService.deleteFile] Falha ao inicializar cliente Supabase:', {
          bucketName,
          fileId
        });
        return { success: false, error: "Erro ao conectar com o servidor de arquivos" };
      }

      // 2. Remover arquivo
      const { error: deleteError } = await supabase.storage
        .from(bucketName)
        .remove([fileId]);

      if (deleteError) {
        console.error('[SupabaseStorageService.deleteFile] Erro ao deletar do Supabase:', {
          bucketName,
          fileId,
          error: deleteError
        });
        const mappedError = StorageErrorMapper.mapError(deleteError);
        return { success: false, error: mappedError };
      }

      return { success: true };
    } catch (error) {
      console.error('[SupabaseStorageService.deleteFile] Erro inesperado:', {
        bucketName,
        fileId,
        error
      });
      const mappedError = StorageErrorMapper.mapError(error);
      return { success: false, error: mappedError };
    }
  }

  /**
   * Gera uma URL assinada de curta duração para um arquivo em bucket privado
   *
   * @param fileId - ID do arquivo (caminho completo)
   * @param bucketName - Nome do bucket
   * @param expiresInSeconds - Tempo de validade da URL assinada, em segundos
   * @returns URL assinada ou erro
   */
  static async createSignedUrl(
    fileId: string,
    bucketName: BucketName,
    expiresInSeconds: number
  ): Promise<{ success: boolean; signedUrl?: string; error?: string }> {
    try {
      const supabase = createSupabaseAdmin();
      if (!supabase) {
        console.error("[SupabaseStorage] Failed to initialize Supabase client");
        return { success: false, error: "Failed to initialize Supabase client" };
      }

      const { data, error } = await supabase.storage
        .from(bucketName)
        .createSignedUrl(fileId, expiresInSeconds);

      if (error || !data) {
        console.error("[SupabaseStorage] Error creating signed URL:", error);
        return { success: false, error: StorageErrorMapper.mapError(error) };
      }

      return { success: true, signedUrl: data.signedUrl };
    } catch (error) {
      console.error("[SupabaseStorage] Unexpected error creating signed URL:", error);
      return { success: false, error: StorageErrorMapper.mapError(error) };
    }
  }

  /**
   * Obtém a URL pública de um arquivo
   *
   * @param fileId - ID do arquivo (caminho completo)
   * @param bucketName - Nome do bucket
   * @returns URL pública ou null
   */
  static getPublicUrl(fileId: string, bucketName: BucketName): string | null {
    try {
      const supabase = createSupabaseAdmin();
      if (!supabase) {
        console.error("[SupabaseStorage] Failed to initialize Supabase client");
        return null;
      }

      const { data } = supabase.storage
        .from(bucketName)
        .getPublicUrl(fileId);

      return data.publicUrl;
    } catch (error) {
      console.error("[SupabaseStorage] Error getting public URL:", error);
      return null;
    }
  }

  /**
   * Lista arquivos de uma entidade (pasta)
   * 
   * @param entityId - ID da entidade (ex: leadId, userId)
   * @param bucketName - Nome do bucket
   * @returns Lista de arquivos ou erro
   */
  static async listFiles(
    entityId: string,
    bucketName: BucketName
  ): Promise<{ success: boolean; files?: any[]; error?: string }> {
    try {
      const supabase = createSupabaseAdmin();
      if (!supabase) {
        return { success: false, error: "Failed to initialize Supabase client" };
      }

      const { data, error } = await supabase.storage
        .from(bucketName)
        .list(entityId);

      if (error) {
        console.error(`[SupabaseStorage] List error in bucket '${bucketName}':`, error);
        return { success: false, error: `List failed: ${error.message}` };
      }

      return { success: true, files: data || [] };
    } catch (error) {
      console.error("[SupabaseStorage] Unexpected error during list:", error);
      return { success: false, error: "Unexpected error during list" };
    }
  }

  /**
   * Obtém configuração de um bucket
   */
  static getBucketConfig(bucketName: BucketName): BucketConfig | null {
    return BUCKET_CONFIGS[bucketName] || null;
  }

  /**
   * Retorna informações sobre todos os buckets configurados
   */
  static getAllBucketsInfo() {
    return Object.entries(BUCKET_CONFIGS).map(([name, config]) => ({
      name,
      ...config,
      maxFileSizeMB: (config.maxFileSize / 1024 / 1024).toFixed(2),
    }));
  }
}

// ============================================
// EXPORTS ADICIONAIS
// ============================================

export default SupabaseStorageService;
