import { SupabaseStorageService, STORAGE_BUCKETS } from "@/lib/supabase/storage"
import type {
  IBackofficeContractStorageService,
  ContractFileUploadResult,
  ContractSignedUrlResult,
} from "./IBackofficeContractStorageService"

export class BackofficeContractStorageService implements IBackofficeContractStorageService {
  async uploadContractFile(file: File, contractId: string): Promise<ContractFileUploadResult> {
    const result = await SupabaseStorageService.uploadFile(
      file,
      STORAGE_BUCKETS.CONTRACTS,
      contractId,
      file.name,
      "v"
    )

    if (!result.success || !result.fileId) {
      return { success: false, error: result.error || "Erro ao fazer upload do contrato" }
    }

    return {
      success: true,
      storagePath: result.fileId,
      fileSize: file.size,
      fileType: file.type,
    }
  }

  async getSignedDownloadUrl(
    storagePath: string,
    expiresInSeconds: number
  ): Promise<ContractSignedUrlResult> {
    const result = await SupabaseStorageService.createSignedUrl(
      storagePath,
      STORAGE_BUCKETS.CONTRACTS,
      expiresInSeconds
    )

    if (!result.success || !result.signedUrl) {
      return { success: false, error: result.error || "Erro ao gerar link de acesso ao contrato" }
    }

    return { success: true, signedUrl: result.signedUrl }
  }

  async deleteContractFile(storagePath: string): Promise<void> {
    await SupabaseStorageService.deleteFile(storagePath, STORAGE_BUCKETS.CONTRACTS)
  }
}

export const backofficeContractStorageService = new BackofficeContractStorageService()
