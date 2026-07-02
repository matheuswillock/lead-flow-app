import type {
  BackofficeContractClientOption,
  BackofficeContractDetail,
  BackofficeContractListItem,
  CreateContractInput,
  IBackofficeContractsService,
  ShareLinkResult,
  UpdateContractInput,
} from "./IBackofficeContractsService"

interface OutputResponse<T> {
  isValid: boolean
  errorMessages?: string[]
  result?: T
}

async function parseOutput<T>(response: Response): Promise<T> {
  const data = (await response.json()) as OutputResponse<T>
  if (!response.ok || !data.isValid || data.result === undefined) {
    throw new Error(data.errorMessages?.[0] ?? "Não foi possível completar a operação")
  }
  return data.result
}

export class BackofficeContractsService implements IBackofficeContractsService {
  async list(filters?: { isActive?: boolean }): Promise<BackofficeContractListItem[]> {
    const params = new URLSearchParams()
    if (filters?.isActive !== undefined) {
      params.set("isActive", String(filters.isActive))
    }
    const query = params.toString()
    return parseOutput<BackofficeContractListItem[]>(
      await fetch(`/api/v1/backoffice/contracts${query ? `?${query}` : ""}`, { cache: "no-store" })
    )
  }

  async listClientOptions(): Promise<BackofficeContractClientOption[]> {
    const clients = await parseOutput<{ id: string; fullName: string }[]>(
      await fetch("/api/v1/backoffice/clients", { cache: "no-store" })
    )
    return clients.map((client) => ({ id: client.id, fullName: client.fullName }))
  }

  async getById(id: string): Promise<BackofficeContractDetail> {
    return parseOutput<BackofficeContractDetail>(
      await fetch(`/api/v1/backoffice/contracts/${id}`, { cache: "no-store" })
    )
  }

  async create(input: CreateContractInput) {
    const formData = new FormData()
    formData.append("title", input.title)
    if (input.description) formData.append("description", input.description)
    if (input.clientId) formData.append("clientId", input.clientId)
    formData.append("file", input.file)

    const response = await fetch("/api/v1/backoffice/contracts", {
      method: "POST",
      body: formData,
    })
    return response.json()
  }

  async addVersion(contractId: string, file: File) {
    const formData = new FormData()
    formData.append("file", file)

    const response = await fetch(`/api/v1/backoffice/contracts/${contractId}/versions`, {
      method: "POST",
      body: formData,
    })
    return response.json()
  }

  async update(id: string, input: UpdateContractInput) {
    const response = await fetch(`/api/v1/backoffice/contracts/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    })
    return response.json()
  }

  async remove(id: string) {
    const response = await fetch(`/api/v1/backoffice/contracts/${id}`, {
      method: "DELETE",
    })
    return response.json()
  }

  async generateShareLink(
    versionId: string
  ): Promise<{ isValid: boolean; errorMessages: string[]; result?: ShareLinkResult }> {
    const response = await fetch(`/api/v1/backoffice/contract-versions/${versionId}/share`, {
      method: "POST",
    })
    return response.json()
  }

  async revokeShareLink(versionId: string) {
    const response = await fetch(`/api/v1/backoffice/contract-versions/${versionId}/share`, {
      method: "DELETE",
    })
    return response.json()
  }
}
