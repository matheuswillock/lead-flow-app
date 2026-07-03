import { prisma } from "@/app/api/infra/data/prisma"
import type {
  IBackofficeContractRepository,
  CreateBackofficeContractInput,
  AddBackofficeContractVersionInput,
  UpdateBackofficeContractInput,
  SetContractVersionShareInput,
  BackofficeContractListItem,
  BackofficeContractDetail,
  BackofficeContractVersionRecord,
  BackofficeContractVersionSummary,
} from "./IBackofficeContractRepository"

const CONTRACT_LIST_SELECT = {
  id: true,
  title: true,
  description: true,
  isActive: true,
  createdAt: true,
  client: { select: { id: true, fullName: true } },
  _count: { select: { versions: true } },
  versions: {
    orderBy: { versionNumber: "desc" as const },
    take: 1,
    select: {
      id: true,
      versionNumber: true,
      fileName: true,
      fileSize: true,
      importedAt: true,
      shareExpiresAt: true,
      importedBy: { select: { id: true, fullName: true } },
    },
  },
}

function toListItem(row: {
  id: string
  title: string
  description: string | null
  isActive: boolean
  createdAt: Date
  client: { id: string; fullName: string } | null
  _count: { versions: number }
  versions: BackofficeContractVersionSummary[]
}): BackofficeContractListItem {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    isActive: row.isActive,
    createdAt: row.createdAt,
    client: row.client,
    versionsCount: row._count.versions,
    latestVersion: row.versions[0] ?? null,
  }
}

export class BackofficeContractRepository implements IBackofficeContractRepository {
  async create(data: CreateBackofficeContractInput): Promise<{ id: string }> {
    const contract = await prisma.backofficeContract.create({
      data: {
        id: data.id,
        title: data.title,
        description: data.description,
        clientId: data.clientId,
        createdByProfileId: data.createdByProfileId,
        versions: {
          create: {
            versionNumber: 1,
            fileName: data.file.fileName,
            storagePath: data.file.storagePath,
            fileSize: data.file.fileSize,
            fileType: data.file.fileType,
            importedByProfileId: data.createdByProfileId,
          },
        },
      },
      select: { id: true },
    })

    return contract
  }

  async findMany(
    filters?: { isActive?: boolean; clientId?: string }
  ): Promise<BackofficeContractListItem[]> {
    const rows = await prisma.backofficeContract.findMany({
      where: {
        isActive: filters?.isActive,
        clientId: filters?.clientId,
      },
      orderBy: { createdAt: "desc" },
      select: CONTRACT_LIST_SELECT,
    })

    return rows.map(toListItem)
  }

  async findById(id: string): Promise<BackofficeContractDetail | null> {
    const row = await prisma.backofficeContract.findUnique({
      where: { id },
      select: {
        ...CONTRACT_LIST_SELECT,
        creator: { select: { id: true, fullName: true } },
      },
    })

    if (!row) return null

    const versions = await prisma.backofficeContractVersion.findMany({
      where: { contractId: id },
      orderBy: { versionNumber: "desc" },
      select: {
        id: true,
        versionNumber: true,
        fileName: true,
        fileSize: true,
        importedAt: true,
        shareExpiresAt: true,
        importedBy: { select: { id: true, fullName: true } },
      },
    })

    return {
      ...toListItem(row),
      createdBy: row.creator,
      versions,
    }
  }

  async countVersions(contractId: string): Promise<number> {
    return prisma.backofficeContractVersion.count({ where: { contractId } })
  }

  async addVersion(
    data: AddBackofficeContractVersionInput
  ): Promise<{ id: string; versionNumber: number }> {
    return prisma.$transaction(async (tx) => {
      const lastVersion = await tx.backofficeContractVersion.findFirst({
        where: { contractId: data.contractId },
        orderBy: { versionNumber: "desc" },
        select: { versionNumber: true },
      })

      const nextVersionNumber = (lastVersion?.versionNumber ?? 0) + 1

      const version = await tx.backofficeContractVersion.create({
        data: {
          contractId: data.contractId,
          versionNumber: nextVersionNumber,
          fileName: data.file.fileName,
          storagePath: data.file.storagePath,
          fileSize: data.file.fileSize,
          fileType: data.file.fileType,
          importedByProfileId: data.importedByProfileId,
        },
        select: { id: true, versionNumber: true },
      })

      return version
    })
  }

  async update(id: string, data: UpdateBackofficeContractInput): Promise<void> {
    await prisma.backofficeContract.update({
      where: { id },
      data: {
        title: data.title,
        description: data.description,
        clientId: data.clientId,
        isActive: data.isActive,
      },
    })
  }

  async delete(id: string): Promise<void> {
    await prisma.backofficeContract.delete({ where: { id } })
  }

  async findVersionById(versionId: string): Promise<BackofficeContractVersionRecord | null> {
    return prisma.backofficeContractVersion.findUnique({
      where: { id: versionId },
      select: {
        id: true,
        contractId: true,
        versionNumber: true,
        storagePath: true,
        fileName: true,
        shareTokenHash: true,
        shareExpiresAt: true,
      },
    })
  }

  async findVersionByShareTokenHash(shareTokenHash: string) {
    const version = await prisma.backofficeContractVersion.findUnique({
      where: { shareTokenHash },
      select: {
        id: true,
        contractId: true,
        versionNumber: true,
        storagePath: true,
        fileName: true,
        fileType: true,
        shareTokenHash: true,
        shareExpiresAt: true,
        contract: { select: { title: true } },
      },
    })

    if (!version) return null

    return {
      id: version.id,
      contractId: version.contractId,
      versionNumber: version.versionNumber,
      storagePath: version.storagePath,
      fileName: version.fileName,
      fileType: version.fileType,
      shareTokenHash: version.shareTokenHash,
      shareExpiresAt: version.shareExpiresAt,
      contractTitle: version.contract.title,
    }
  }

  async setVersionShare(versionId: string, data: SetContractVersionShareInput): Promise<void> {
    await prisma.backofficeContractVersion.update({
      where: { id: versionId },
      data: {
        shareTokenHash: data.shareTokenHash,
        shareExpiresAt: data.shareExpiresAt,
        shareGeneratedByProfileId: data.shareGeneratedByProfileId,
        shareGeneratedAt: data.shareGeneratedAt,
      },
    })
  }

  async revokeVersionShare(versionId: string): Promise<void> {
    await prisma.backofficeContractVersion.update({
      where: { id: versionId },
      data: { shareExpiresAt: new Date() },
    })
  }
}
