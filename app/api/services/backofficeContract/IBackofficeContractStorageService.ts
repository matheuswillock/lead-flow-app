export interface ContractFileUploadResult {
  success: boolean
  storagePath?: string
  fileSize?: number
  fileType?: string
  error?: string
}

export interface ContractSignedUrlResult {
  success: boolean
  signedUrl?: string
  error?: string
}

export interface IBackofficeContractStorageService {
  uploadContractFile(file: File, contractId: string): Promise<ContractFileUploadResult>
  getSignedDownloadUrl(storagePath: string, expiresInSeconds: number): Promise<ContractSignedUrlResult>
  deleteContractFile(storagePath: string): Promise<void>
}
