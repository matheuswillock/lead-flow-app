export type BackofficeContractClientOption = {
  id: string
  fullName: string
}

export type BackofficeContractVersionSummary = {
  id: string
  versionNumber: number
  fileName: string
  fileSize: number
  importedAt: string
  importedBy: { id: string; fullName: string | null } | null
  shareExpiresAt: string | null
}

export type BackofficeContractListItem = {
  id: string
  title: string
  description: string | null
  isActive: boolean
  createdAt: string
  client: { id: string; fullName: string } | null
  versionsCount: number
  latestVersion: BackofficeContractVersionSummary | null
}

export type BackofficeContractDetail = BackofficeContractListItem & {
  createdBy: { id: string; fullName: string | null } | null
  versions: BackofficeContractVersionSummary[]
}

export type CreateContractInput = {
  title: string
  description?: string
  clientId?: string
  file: File
}

export type UpdateContractInput = {
  title?: string
  description?: string | null
  clientId?: string | null
  isActive?: boolean
}

export type ShareLinkResult = {
  shareUrl: string
  expiresAt: string
}

export interface IBackofficeContractsService {
  list(filters?: { isActive?: boolean }): Promise<BackofficeContractListItem[]>
  listClientOptions(): Promise<BackofficeContractClientOption[]>
  getById(id: string): Promise<BackofficeContractDetail>
  create(input: CreateContractInput): Promise<{ isValid: boolean; errorMessages: string[] }>
  addVersion(
    contractId: string,
    file: File
  ): Promise<{ isValid: boolean; errorMessages: string[] }>
  update(
    id: string,
    input: UpdateContractInput
  ): Promise<{ isValid: boolean; errorMessages: string[] }>
  remove(id: string): Promise<{ isValid: boolean; errorMessages: string[] }>
  generateShareLink(
    versionId: string
  ): Promise<{ isValid: boolean; errorMessages: string[]; result?: ShareLinkResult }>
  revokeShareLink(versionId: string): Promise<{ isValid: boolean; errorMessages: string[] }>
}
