import { Output } from "@/lib/output"
import { AcceptanceServiceError, type IBackofficeTermsAcceptanceService, type SubmitAcceptanceInput } from "@/app/api/services/BackofficeTermsAcceptance/IBackofficeTermsAcceptanceService"
import { backofficeTermsAcceptanceService } from "@/app/api/services/BackofficeTermsAcceptance/BackofficeTermsAcceptanceService"
import type { IBackofficeTermsAcceptanceUseCase } from "./IBackofficeTermsAcceptanceUseCase"

function errorOutput(error: unknown, fallback: string): Output {
  if (error instanceof AcceptanceServiceError) {
    return new Output(false, [], [error.message], { code: error.code })
  }
  console.error("[BackofficeTermsAcceptanceUseCase]", error)
  return new Output(false, [], [fallback], null)
}

export class BackofficeTermsAcceptanceUseCase implements IBackofficeTermsAcceptanceUseCase {
  constructor(private readonly service: IBackofficeTermsAcceptanceService) {}

  async getPageData(token: string): Promise<Output> {
    try {
      return new Output(true, [], [], await this.service.getPageDataByToken(token))
    } catch (error) {
      return errorOutput(error, "Erro ao carregar os documentos para aceite")
    }
  }

  async submit(token: string, input: SubmitAcceptanceInput): Promise<Output> {
    try {
      const result = await this.service.submitAcceptance(token, input)
      return new Output(true, [result.alreadyAccepted ? "Aceite já registrado" : "Aceite registrado com sucesso"], [], result)
    } catch (error) {
      return errorOutput(error, "Erro ao registrar o aceite")
    }
  }

  async getByProfile(profileId: string): Promise<Output> {
    try {
      return new Output(true, [], [], await this.service.getAcceptanceByProfile(profileId))
    } catch (error) {
      return errorOutput(error, "Erro ao consultar o aceite")
    }
  }

  async markFirstAccess(profileId: string): Promise<Output> {
    try {
      await this.service.markFirstPlatformAccess(profileId)
      return new Output(true, [], [], null)
    } catch (error) {
      return errorOutput(error, "Erro ao registrar o primeiro acesso")
    }
  }

  async getEvidenceDownload(profileId: string): Promise<Output> {
    try {
      return new Output(true, [], [], await this.service.getEvidenceDownload(profileId))
    } catch (error) {
      return errorOutput(error, "Erro ao gerar o download do comprovante")
    }
  }

  async listLegalDocuments(): Promise<Output> {
    try { return new Output(true, [], [], await this.service.listLegalDocuments()) }
    catch (error) { return errorOutput(error, "Erro ao listar documentos jurídicos") }
  }

  async createLegalDocument(input: Parameters<IBackofficeTermsAcceptanceService["createLegalDocument"]>[0]): Promise<Output> {
    try { return new Output(true, ["Documento criado"], [], await this.service.createLegalDocument(input)) }
    catch (error) { return errorOutput(error, "Erro ao criar documento jurídico") }
  }

  async publishDocumentSet(input: Parameters<IBackofficeTermsAcceptanceService["publishDocumentSet"]>[0]): Promise<Output> {
    try { return new Output(true, ["Conjunto documental publicado"], [], await this.service.publishDocumentSet(input)) }
    catch (error) { return errorOutput(error, "Erro ao publicar conjunto documental") }
  }

  async retryFailedProcessing(profileId: string): Promise<Output> {
    try { return new Output(true, ["Reprocessamento agendado"], [], await this.service.retryFailedProcessing(profileId)) }
    catch (error) { return errorOutput(error, "Erro ao reagendar o processamento") }
  }
}

export const backofficeTermsAcceptanceUseCase = new BackofficeTermsAcceptanceUseCase(backofficeTermsAcceptanceService)
