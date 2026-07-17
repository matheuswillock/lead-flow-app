import { Output } from "@/lib/output"
import type { BackofficeEmailImportSourceFormat } from "@prisma/client"
import {
  backofficeEmailContactListRepository,
  type BackofficeEmailContactListRepository,
} from "@/app/api/infra/data/repositories/backoffice/backofficeEmailContactList/BackofficeEmailContactListRepository"
import {
  backofficeEmailContactRepository,
  type BackofficeEmailContactRepository,
} from "@/app/api/infra/data/repositories/backoffice/backofficeEmailContact/BackofficeEmailContactRepository"
import {
  backofficeEmailImportJobRepository,
  type BackofficeEmailImportJobRepository,
} from "@/app/api/infra/data/repositories/backoffice/backofficeEmailImportJob/BackofficeEmailImportJobRepository"
import type {
  CreateBackofficeEmailContactListData,
  IBackofficeEmailContactListUseCase,
} from "./IBackofficeEmailContactListUseCase"

const MAX_RAW_CONTENT_LENGTH = 10 * 1024 * 1024 // 10MB as text

export class BackofficeEmailContactListUseCase implements IBackofficeEmailContactListUseCase {
  constructor(
    private readonly listRepository: BackofficeEmailContactListRepository = backofficeEmailContactListRepository,
    private readonly contactRepository: BackofficeEmailContactRepository = backofficeEmailContactRepository,
    private readonly importJobRepository: BackofficeEmailImportJobRepository = backofficeEmailImportJobRepository
  ) {}

  async list(): Promise<Output> {
    const lists = await this.listRepository.findMany()
    return new Output(true, [], [], lists)
  }

  async create(
    data: CreateBackofficeEmailContactListData,
    backofficeUserId: string
  ): Promise<Output> {
    if (!data.name?.trim()) {
      return new Output(false, [], ["Nome da lista é obrigatório"], null)
    }
    const created = await this.listRepository.create({
      name: data.name.trim(),
      createdByBackofficeUserId: backofficeUserId,
    })
    return new Output(true, ["Lista criada com sucesso"], [], created)
  }

  async getById(id: string): Promise<Output> {
    const list = await this.listRepository.findById(id)
    if (!list) {
      return new Output(false, [], ["Lista não encontrada"], null)
    }
    return new Output(true, [], [], list)
  }

  async archive(id: string): Promise<Output> {
    const list = await this.listRepository.findById(id)
    if (!list) {
      return new Output(false, [], ["Lista não encontrada"], null)
    }
    if (list.isSystemDefault) {
      return new Output(false, [], ["Não é possível arquivar a lista sistêmica"], null)
    }
    const archived = await this.listRepository.archive(id)
    return new Output(true, ["Lista arquivada com sucesso"], [], archived)
  }

  async listContacts(id: string, page: number, pageSize: number): Promise<Output> {
    const list = await this.listRepository.findById(id)
    if (!list) {
      return new Output(false, [], ["Lista não encontrada"], null)
    }
    const result = await this.contactRepository.listByListId(id, { page, pageSize })
    return new Output(true, [], [], result)
  }

  async updateContact(
    listId: string,
    contactId: string,
    data: { name?: string | null }
  ): Promise<Output> {
    const contact = await this.contactRepository.findById(contactId)
    if (!contact || contact.listId !== listId) {
      return new Output(false, [], ["Contato não encontrado"], null)
    }
    // Only manual field currently supported is `name`; email/list are immutable via this path.
    const updated = await this.contactRepository.upsertActive({
      listId,
      email: contact.email,
      name: data.name,
    })
    return new Output(true, ["Contato atualizado com sucesso"], [], updated)
  }

  async deleteContact(listId: string, contactId: string): Promise<Output> {
    const contact = await this.contactRepository.findById(contactId)
    if (!contact || contact.listId !== listId) {
      return new Output(false, [], ["Contato não encontrado"], null)
    }
    await this.contactRepository.delete(contactId)
    await this.listRepository.incrementTotalContacts(listId, -1)
    return new Output(true, ["Contato removido com sucesso"], [], null)
  }

  async enqueueUpload(
    listId: string,
    sourceFormat: BackofficeEmailImportSourceFormat,
    rawContent: string,
    backofficeUserId: string
  ): Promise<Output> {
    const list = await this.listRepository.findById(listId)
    if (!list) {
      return new Output(false, [], ["Lista não encontrada"], null)
    }
    if (!rawContent.trim()) {
      return new Output(false, [], ["Arquivo vazio"], null)
    }
    if (rawContent.length > MAX_RAW_CONTENT_LENGTH) {
      return new Output(false, [], ["Arquivo muito grande. Tamanho máximo: 10MB"], null)
    }

    const job = await this.importJobRepository.create({
      listId,
      sourceFormat,
      rawContent,
      createdByBackofficeUserId: backofficeUserId,
    })
    return new Output(true, ["Importação enfileirada com sucesso"], [], job)
  }
}

export const backofficeEmailContactListUseCase = new BackofficeEmailContactListUseCase()
