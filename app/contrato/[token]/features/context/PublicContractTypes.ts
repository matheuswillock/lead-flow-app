export interface PublicContractShare {
  contractTitle: string
  fileName: string
  versionNumber: number
  expiresAt: string
}

export interface PublicContractDownload {
  downloadUrl: string
  downloadExpiresAt: string
  shareExpiresAt: string
}
