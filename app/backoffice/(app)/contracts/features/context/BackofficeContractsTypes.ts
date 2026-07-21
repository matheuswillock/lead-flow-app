import type {
  BackofficeContractClientOption,
  BackofficeContractDetail,
  BackofficeContractListItem,
  CreateContractInput,
  ShareLinkResult,
  UpdateContractInput,
} from "../services/IBackofficeContractsService"

export type {
  BackofficeContractClientOption,
  BackofficeContractDetail,
  BackofficeContractListItem,
  CreateContractInput,
  ShareLinkResult,
  UpdateContractInput,
}

export type BackofficeContractsState = {
  items: BackofficeContractListItem[]
  clientOptions: BackofficeContractClientOption[]
  isLoading: boolean
  isSaving: boolean
  error: string | null
}

export type ActionResult = { isValid: boolean; errorMessages: string[] }

export type BackofficeContractsActions = {
  refresh: () => Promise<void>
  createContract: (input: CreateContractInput) => Promise<ActionResult>
  addVersion: (contractId: string, file: File) => Promise<ActionResult>
  updateContract: (id: string, input: UpdateContractInput) => Promise<ActionResult>
  deleteContract: (id: string) => Promise<ActionResult>
  getContractDetail: (id: string) => Promise<BackofficeContractDetail>
  generateShareLink: (versionId: string) => Promise<ActionResult & { result?: ShareLinkResult }>
  revokeShareLink: (versionId: string) => Promise<ActionResult>
}

export type BackofficeContractsContextValue = BackofficeContractsState &
  BackofficeContractsActions & { canManage: boolean }
