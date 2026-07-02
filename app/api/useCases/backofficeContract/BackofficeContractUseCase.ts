import { randomUUID } from "crypto"
import { Output } from "@/lib/output"
import { getFullUrl } from "@/lib/utils/app-url"
import {
  generateContractShareToken,
  hashContractShareToken,
  getContractShareExpiry,
  isContractShareExpired,
} from "@/lib/backoffice-contracts/contract-share-token"
import { BackofficeContractRepository } from "@/app/api/infra/data/repositories/backoffice/backofficeContract/BackofficeContractRepository"
import { backofficeContractStorageService } from "@/app/api/services/backofficeContract/BackofficeContractStorageService"
import type { IBackofficeContractRepository } from "@/app/api/infra/data/repositories/backoffice/backofficeContract/IBackofficeContractRepository"
import type { IBackofficeContractStorageService } from "@/app/api/services/backofficeContract/IBackofficeContractStorageService"

const PUBLIC_SIGNED_URL_TTL_SECONDS = 5 * 60

export interface CreateContractPayload {
  title: string
  description?: string
  clientId?: string
}

export interface UpdateContractPayload {
  title?: string
  description?: string | null
  clientId?: string | null
  isActive?: boolean
}

export class BackofficeContractUseCase {
  constructor(
    private readonly contractRepository: IBackofficeContractRepository,
    private readonly storageService: IBackofficeContractStorageService
  ) {}

  async createContract(payload: CreateContractPayload, file: File, profileId: string): Promise<Output> {
    if (!payload.title?.trim()) {
      return new Output(false, [], ["Título do contrato é obrigatório"], null)
    }
    if (!file) {
      return new Output(false, [], ["Arquivo PDF do contrato é obrigatório"], null)
    }

    const contractId = randomUUID()
    const uploadResult = await this.storageService.uploadContractFile(file, contractId)
    if (!uploadResult.success || !uploadResult.storagePath) {
      return new Output(false, [], [uploadResult.error || "Erro ao fazer upload do contrato"], null)
    }

    try {
      const created = await this.contractRepository.create({
        id: contractId,
        title: payload.title.trim(),
        description: payload.description?.trim() || undefined,
        clientId: payload.clientId || undefined,
        createdByProfileId: profileId,
        file: {
          fileName: file.name,
          storagePath: uploadResult.storagePath,
          fileSize: uploadResult.fileSize ?? file.size,
          fileType: uploadResult.fileType ?? file.type,
        },
      })

      return new Output(true, ["Contrato criado com sucesso"], [], created)
    } catch (error) {
      await this.storageService.deleteContractFile(uploadResult.storagePath)
      console.error("[BackofficeContractUseCase][createContract] Erro ao salvar contrato:", error)
      return new Output(false, [], ["Erro inesperado ao criar o contrato. Tente novamente"], null)
    }
  }

  async listContracts(filters?: { isActive?: boolean; clientId?: string }): Promise<Output> {
    try {
      const contracts = await this.contractRepository.findMany(filters)
      return new Output(true, [], [], contracts)
    } catch (error) {
      console.error("[BackofficeContractUseCase][listContracts] Erro ao listar contratos:", error)
      return new Output(false, [], ["Erro inesperado ao listar contratos"], null)
    }
  }

  async getContractById(id: string): Promise<Output> {
    const contract = await this.contractRepository.findById(id)
    if (!contract) {
      return new Output(false, [], ["Contrato não encontrado"], null)
    }
    return new Output(true, [], [], contract)
  }

  async addVersion(contractId: string, file: File, profileId: string): Promise<Output> {
    if (!file) {
      return new Output(false, [], ["Arquivo PDF do contrato é obrigatório"], null)
    }

    const contract = await this.contractRepository.findById(contractId)
    if (!contract) {
      return new Output(false, [], ["Contrato não encontrado"], null)
    }

    const uploadResult = await this.storageService.uploadContractFile(file, contractId)
    if (!uploadResult.success || !uploadResult.storagePath) {
      return new Output(false, [], [uploadResult.error || "Erro ao fazer upload do contrato"], null)
    }

    try {
      const version = await this.contractRepository.addVersion({
        contractId,
        importedByProfileId: profileId,
        file: {
          fileName: file.name,
          storagePath: uploadResult.storagePath,
          fileSize: uploadResult.fileSize ?? file.size,
          fileType: uploadResult.fileType ?? file.type,
        },
      })

      return new Output(true, ["Nova versão do contrato importada com sucesso"], [], version)
    } catch (error) {
      await this.storageService.deleteContractFile(uploadResult.storagePath)
      console.error("[BackofficeContractUseCase][addVersion] Erro ao salvar nova versão:", error)
      return new Output(false, [], ["Erro inesperado ao importar nova versão. Tente novamente"], null)
    }
  }

  async updateContract(id: string, payload: UpdateContractPayload): Promise<Output> {
    const contract = await this.contractRepository.findById(id)
    if (!contract) {
      return new Output(false, [], ["Contrato não encontrado"], null)
    }

    try {
      await this.contractRepository.update(id, {
        title: payload.title?.trim(),
        description: payload.description === undefined ? undefined : payload.description?.trim() || null,
        clientId: payload.clientId,
        isActive: payload.isActive,
      })

      return new Output(true, ["Contrato atualizado com sucesso"], [], null)
    } catch (error) {
      console.error("[BackofficeContractUseCase][updateContract] Erro ao atualizar contrato:", error)
      return new Output(false, [], ["Erro inesperado ao atualizar o contrato"], null)
    }
  }

  async deleteContract(id: string): Promise<Output> {
    const contract = await this.contractRepository.findById(id)
    if (!contract) {
      return new Output(false, [], ["Contrato não encontrado"], null)
    }

    const versionsCount = await this.contractRepository.countVersions(id)
    if (versionsCount > 0) {
      return new Output(
        false,
        [],
        ["Não é possível excluir um contrato com versões importadas. Arquive-o em vez disso."],
        null
      )
    }

    try {
      await this.contractRepository.delete(id)
      return new Output(true, ["Contrato excluído com sucesso"], [], null)
    } catch (error) {
      console.error("[BackofficeContractUseCase][deleteContract] Erro ao excluir contrato:", error)
      return new Output(false, [], ["Erro inesperado ao excluir o contrato"], null)
    }
  }

  async generateShareLink(versionId: string, profileId: string): Promise<Output> {
    const version = await this.contractRepository.findVersionById(versionId)
    if (!version) {
      return new Output(false, [], ["Versão do contrato não encontrada"], null)
    }

    const rawToken = generateContractShareToken()
    const shareExpiresAt = getContractShareExpiry()

    try {
      await this.contractRepository.setVersionShare(versionId, {
        shareTokenHash: hashContractShareToken(rawToken),
        shareExpiresAt,
        shareGeneratedByProfileId: profileId,
        shareGeneratedAt: new Date(),
      })

      return new Output(true, ["Link de compartilhamento gerado com sucesso"], [], {
        shareUrl: getFullUrl(`/contrato/${rawToken}`),
        expiresAt: shareExpiresAt,
      })
    } catch (error) {
      console.error("[BackofficeContractUseCase][generateShareLink] Erro ao gerar link:", error)
      return new Output(false, [], ["Erro inesperado ao gerar o link de compartilhamento"], null)
    }
  }

  async revokeShareLink(versionId: string): Promise<Output> {
    const version = await this.contractRepository.findVersionById(versionId)
    if (!version) {
      return new Output(false, [], ["Versão do contrato não encontrada"], null)
    }

    try {
      await this.contractRepository.revokeVersionShare(versionId)
      return new Output(true, ["Link de compartilhamento revogado com sucesso"], [], null)
    } catch (error) {
      console.error("[BackofficeContractUseCase][revokeShareLink] Erro ao revogar link:", error)
      return new Output(false, [], ["Erro inesperado ao revogar o link de compartilhamento"], null)
    }
  }

  async resolvePublicShare(token: string): Promise<Output> {
    if (!token?.trim()) {
      return new Output(false, [], ["Link inválido"], null)
    }

    const tokenHash = hashContractShareToken(token)
    const version = await this.contractRepository.findVersionByShareTokenHash(tokenHash)

    if (!version) {
      return new Output(false, [], ["Link inválido ou não encontrado"], null)
    }

    if (isContractShareExpired(version.shareExpiresAt)) {
      return new Output(false, [], ["Link expirado"], null)
    }

    const signedUrlResult = await this.storageService.getSignedDownloadUrl(
      version.storagePath,
      PUBLIC_SIGNED_URL_TTL_SECONDS
    )

    if (!signedUrlResult.success || !signedUrlResult.signedUrl) {
      return new Output(
        false,
        [],
        [signedUrlResult.error || "Erro ao gerar link de acesso ao contrato"],
        null
      )
    }

    return new Output(true, [], [], {
      contractTitle: version.contractTitle,
      fileName: version.fileName,
      versionNumber: version.versionNumber,
      downloadUrl: signedUrlResult.signedUrl,
      expiresAt: version.shareExpiresAt,
    })
  }
}

export const backofficeContractUseCase = new BackofficeContractUseCase(
  new BackofficeContractRepository(),
  backofficeContractStorageService
)
