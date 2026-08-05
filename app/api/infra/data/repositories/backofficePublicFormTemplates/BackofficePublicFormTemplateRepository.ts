import { Prisma } from "@prisma/client"
import { prisma } from "@/app/api/infra/data/prisma"
import type { PublicFormDraftInput } from "@/lib/public-forms/types"
import type {
  BackofficePublicFormTemplateDetail,
  BackofficePublicFormTemplateListItem,
  CreateBackofficePublicFormTemplateInput,
  IBackofficePublicFormTemplateRepository,
  UpdateBackofficePublicFormTemplateInput,
} from "./IBackofficePublicFormTemplateRepository"

function json(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue
}

function mapListItem(row: {
  id: string
  slug: string
  name: string
  description: string | null
  formKind: string
  sortOrder: number
  isActive: boolean
  updatedAt: Date
}): BackofficePublicFormTemplateListItem {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    description: row.description,
    formKind: row.formKind,
    sortOrder: row.sortOrder,
    isActive: row.isActive,
    updatedAt: row.updatedAt.toISOString(),
  }
}

function mapDetail(row: {
  id: string
  slug: string
  name: string
  description: string | null
  formKind: string
  sortOrder: number
  isActive: boolean
  updatedAt: Date
  draft: unknown
}): BackofficePublicFormTemplateDetail {
  return {
    ...mapListItem(row),
    draft: row.draft as PublicFormDraftInput,
  }
}

const listSelect = {
  id: true,
  slug: true,
  name: true,
  description: true,
  formKind: true,
  sortOrder: true,
  isActive: true,
  updatedAt: true,
} as const

export class BackofficePublicFormTemplateRepository
  implements IBackofficePublicFormTemplateRepository
{
  async list(includeInactive: boolean): Promise<BackofficePublicFormTemplateListItem[]> {
    const rows = await prisma.publicFormTemplate.findMany({
      where: {
        teamId: null,
        ...(includeInactive ? {} : { isActive: true }),
      },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      select: listSelect,
    })
    return rows.map(mapListItem)
  }

  async findById(id: string): Promise<BackofficePublicFormTemplateDetail | null> {
    const row = await prisma.publicFormTemplate.findFirst({
      where: { id, teamId: null },
      select: { ...listSelect, draft: true },
    })
    return row ? mapDetail(row) : null
  }

  async findBySlug(slug: string): Promise<BackofficePublicFormTemplateDetail | null> {
    const row = await prisma.publicFormTemplate.findFirst({
      where: { slug, teamId: null },
      select: { ...listSelect, draft: true },
    })
    return row ? mapDetail(row) : null
  }

  async create(
    input: CreateBackofficePublicFormTemplateInput,
  ): Promise<BackofficePublicFormTemplateDetail> {
    const row = await prisma.publicFormTemplate.create({
      data: {
        slug: input.slug,
        name: input.name,
        description: input.description ?? null,
        formKind: input.formKind ?? "standard",
        sortOrder: input.sortOrder ?? 0,
        draft: json(input.draft),
        isActive: false,
        teamId: null,
      },
      select: { ...listSelect, draft: true },
    })
    return mapDetail(row)
  }

  async update(
    id: string,
    input: UpdateBackofficePublicFormTemplateInput,
  ): Promise<BackofficePublicFormTemplateDetail | null> {
    const existing = await this.findById(id)
    if (!existing) return null

    const row = await prisma.publicFormTemplate.update({
      where: { id },
      data: {
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.description !== undefined ? { description: input.description } : {}),
        ...(input.formKind !== undefined ? { formKind: input.formKind } : {}),
        ...(input.sortOrder !== undefined ? { sortOrder: input.sortOrder } : {}),
        ...(input.draft !== undefined ? { draft: json(input.draft) } : {}),
        ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
        teamId: null,
      },
      select: { ...listSelect, draft: true },
    })
    return mapDetail(row)
  }
}

export const backofficePublicFormTemplateRepository =
  new BackofficePublicFormTemplateRepository()
