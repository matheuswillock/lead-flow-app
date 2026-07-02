export interface BackofficeContractClientSummary {
  id: string
  fullName: string
}

export interface BackofficeContractVersionSummary {
  id: string
  versionNumber: number
  fileName: string
  fileSize: number
  importedAt: Date
  importedBy: { id: string; fullName: string | null } | null
  shareExpiresAt: Date | null
}

export interface BackofficeContractListItem {
  id: string
  title: string
  description: string | null
  isActive: boolean
  createdAt: Date
  client: BackofficeContractClientSummary | null
  versionsCount: number
  latestVersion: BackofficeContractVersionSummary | null
}

export interface BackofficeContractDetail extends BackofficeContractListItem {
  createdBy: { id: string; fullName: string | null } | null
  versions: BackofficeContractVersionSummary[]
}

export interface CreateBackofficeContractInput {
  id: string
  title: string
  description?: string
  clientId?: string
  createdByProfileId: string
  file: {
    fileName: string
    storagePath: string
    fileSize: number
    fileType: string
  }
}

export interface AddBackofficeContractVersionInput {
  contractId: string
  importedByProfileId: string
  file: {
    fileName: string
    storagePath: string
    fileSize: number
    fileType: string
  }
}

export interface UpdateBackofficeContractInput {
  title?: string
  description?: string | null
  clientId?: string | null
  isActive?: boolean
}

export interface BackofficeContractVersionRecord {
  id: string
  contractId: string
  versionNumber: number
  storagePath: string
  fileName: string
  shareTokenHash: string | null
  shareExpiresAt: Date | null
}

export interface SetContractVersionShareInput {
  shareTokenHash: string
  shareExpiresAt: Date
  shareGeneratedByProfileId: string
  shareGeneratedAt: Date
}

export interface IBackofficeContractRepository {
  create(data: CreateBackofficeContractInput): Promise<{ id: string }>
  findMany(filters?: { isActive?: boolean; clientId?: string }): Promise<BackofficeContractListItem[]>
  findById(id: string): Promise<BackofficeContractDetail | null>
  countVersions(contractId: string): Promise<number>
  addVersion(data: AddBackofficeContractVersionInput): Promise<{ id: string; versionNumber: number }>
  update(id: string, data: UpdateBackofficeContractInput): Promise<void>
  delete(id: string): Promise<void>
  findVersionById(versionId: string): Promise<BackofficeContractVersionRecord | null>
  findVersionByShareTokenHash(shareTokenHash: string): Promise<
    (BackofficeContractVersionRecord & { fileType: string; contractTitle: string }) | null
  >
  setVersionShare(versionId: string, data: SetContractVersionShareInput): Promise<void>
  revokeVersionShare(versionId: string): Promise<void>
}
