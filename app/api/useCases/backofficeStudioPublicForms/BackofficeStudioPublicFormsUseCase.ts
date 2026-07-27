import { Output } from "@/lib/output"
import type { BackofficeAccess } from "@/app/api/v1/backoffice/utils/getBackofficeAccess"
import { buildStudioEmailTeamContext } from "@/app/api/v1/backoffice/utils/buildStudioEmailTeamContext"
import type { TeamAccess } from "@/app/api/v1/utils/teamAccess"
import {
  publicFormsUseCase,
  PublicFormsUseCase,
} from "@/app/api/useCases/publicForms/PublicFormsUseCase"
import type { PublicFormDraftInput, PublicFormListFilters } from "@/lib/public-forms/types"
import { backofficeStudioPublicFormsRepository } from "@/app/api/infra/data/repositories/backoffice/studioPublicForms/BackofficeStudioPublicFormsRepository"

export type StudioPublicFormsActor = {
  access: BackofficeAccess
  masterId: string
  teamId: string
}

type ManagedRow = Record<string, unknown> & { managedByBackofficeUserId?: string | null }

function withManagedFlag<T extends ManagedRow>(row: T): Omit<T, "managedByBackofficeUserId"> & {
  managedByCorretorStudio: boolean
} {
  const { managedByBackofficeUserId, managedByCorretorStudio, ...rest } = row as ManagedRow & {
    managedByCorretorStudio?: boolean
  }
  return {
    ...(rest as Omit<T, "managedByBackofficeUserId">),
    managedByCorretorStudio:
      typeof managedByCorretorStudio === "boolean"
        ? managedByCorretorStudio
        : Boolean(managedByBackofficeUserId),
  }
}

function mapResultManaged(result: unknown): unknown {
  if (result == null) return result
  if (Array.isArray(result)) {
    return result.map((item) =>
      item && typeof item === "object" ? withManagedFlag(item as ManagedRow) : item
    )
  }
  if (typeof result === "object") {
    const obj = result as Record<string, unknown>
    if (Array.isArray(obj.items)) {
      return {
        ...obj,
        items: (obj.items as unknown[]).map((item) =>
          item && typeof item === "object" ? withManagedFlag(item as ManagedRow) : item
        ),
      }
    }
    return withManagedFlag(obj as ManagedRow)
  }
  return result
}

function decorateOutput(output: Output): Output {
  return new Output(
    output.isValid,
    output.successMessages,
    output.errorMessages,
    mapResultManaged(output.result)
  )
}

async function resolveCtx(actor: StudioPublicFormsActor): Promise<
  | { ctx: TeamAccess; error?: never; status?: never }
  | { ctx?: never; error: Output; status: number }
> {
  const built = await buildStudioEmailTeamContext(actor.masterId, actor.teamId)
  if (built.error) return { error: built.error, status: built.status }
  return { ctx: built.ctx }
}

function extractId(result: unknown): string | null {
  if (result && typeof result === "object" && "id" in result && typeof (result as { id: unknown }).id === "string") {
    return (result as { id: string }).id
  }
  return null
}

async function stampForm(id: string, backofficeUserId: string | null) {
  if (!backofficeUserId) return
  await backofficeStudioPublicFormsRepository.stampForm(id, backofficeUserId)
}

export class BackofficeStudioPublicFormsUseCase {
  private forms: PublicFormsUseCase = publicFormsUseCase

  async list(actor: StudioPublicFormsActor, filters: PublicFormListFilters): Promise<Output> {
    const resolved = await resolveCtx(actor)
    if (resolved.error) return resolved.error
    return decorateOutput(await this.forms.list(resolved.ctx, filters))
  }

  async get(actor: StudioPublicFormsActor, formId: string): Promise<Output> {
    const resolved = await resolveCtx(actor)
    if (resolved.error) return resolved.error
    return decorateOutput(await this.forms.get(resolved.ctx, formId))
  }

  async create(actor: StudioPublicFormsActor, input: PublicFormDraftInput): Promise<Output> {
    const resolved = await resolveCtx(actor)
    if (resolved.error) return resolved.error
    const output = await this.forms.create(resolved.ctx, input)
    const id = extractId(output.result)
    if (output.isValid && id) {
      await stampForm(id, actor.access.backofficeUserId)
      return decorateOutput(await this.forms.get(resolved.ctx, id))
    }
    return decorateOutput(output)
  }

  async update(
    actor: StudioPublicFormsActor,
    formId: string,
    input: PublicFormDraftInput
  ): Promise<Output> {
    const resolved = await resolveCtx(actor)
    if (resolved.error) return resolved.error
    const output = await this.forms.update(resolved.ctx, formId, input)
    if (output.isValid) {
      await stampForm(formId, actor.access.backofficeUserId)
      return decorateOutput(await this.forms.get(resolved.ctx, formId))
    }
    return decorateOutput(output)
  }

  async duplicate(actor: StudioPublicFormsActor, formId: string): Promise<Output> {
    const resolved = await resolveCtx(actor)
    if (resolved.error) return resolved.error
    const output = await this.forms.duplicate(resolved.ctx, formId)
    const id = extractId(output.result)
    if (output.isValid && id) {
      await stampForm(id, actor.access.backofficeUserId)
      return decorateOutput(await this.forms.get(resolved.ctx, id))
    }
    return decorateOutput(output)
  }

  async publish(actor: StudioPublicFormsActor, formId: string): Promise<Output> {
    const resolved = await resolveCtx(actor)
    if (resolved.error) return resolved.error
    const output = await this.forms.publish(resolved.ctx, formId)
    if (output.isValid) {
      await stampForm(formId, actor.access.backofficeUserId)
    }
    return decorateOutput(output)
  }

  async archive(actor: StudioPublicFormsActor, formId: string): Promise<Output> {
    const resolved = await resolveCtx(actor)
    if (resolved.error) return resolved.error
    const output = await this.forms.archive(resolved.ctx, formId)
    if (output.isValid) {
      await stampForm(formId, actor.access.backofficeUserId)
    }
    return decorateOutput(output)
  }

  async restore(actor: StudioPublicFormsActor, formId: string): Promise<Output> {
    const resolved = await resolveCtx(actor)
    if (resolved.error) return resolved.error
    const output = await this.forms.restore(resolved.ctx, formId)
    if (output.isValid) {
      await stampForm(formId, actor.access.backofficeUserId)
    }
    return decorateOutput(output)
  }

  async submitApproval(actor: StudioPublicFormsActor, formId: string): Promise<Output> {
    const resolved = await resolveCtx(actor)
    if (resolved.error) return resolved.error
    const output = await this.forms.submitApproval(resolved.ctx, formId)
    if (output.isValid) {
      await stampForm(formId, actor.access.backofficeUserId)
    }
    return decorateOutput(output)
  }

  async approve(actor: StudioPublicFormsActor, formId: string): Promise<Output> {
    const resolved = await resolveCtx(actor)
    if (resolved.error) return resolved.error
    const output = await this.forms.approve(resolved.ctx, formId)
    if (output.isValid) {
      await stampForm(formId, actor.access.backofficeUserId)
    }
    return decorateOutput(output)
  }

  async reject(actor: StudioPublicFormsActor, formId: string, comment: string): Promise<Output> {
    const resolved = await resolveCtx(actor)
    if (resolved.error) return resolved.error
    const output = await this.forms.reject(resolved.ctx, formId, comment)
    if (output.isValid) {
      await stampForm(formId, actor.access.backofficeUserId)
    }
    return decorateOutput(output)
  }

  async preview(actor: StudioPublicFormsActor, formId: string): Promise<Output> {
    const resolved = await resolveCtx(actor)
    if (resolved.error) return resolved.error
    return decorateOutput(await this.forms.preview(resolved.ctx, formId))
  }

  async analytics(
    actor: StudioPublicFormsActor,
    formId: string,
    from?: Date,
    to?: Date,
    publicationId?: string
  ): Promise<Output> {
    const resolved = await resolveCtx(actor)
    if (resolved.error) return resolved.error
    return decorateOutput(
      await this.forms.analytics(resolved.ctx, formId, from, to, publicationId)
    )
  }

  async getSettings(actor: StudioPublicFormsActor): Promise<Output> {
    const resolved = await resolveCtx(actor)
    if (resolved.error) return resolved.error
    return decorateOutput(await this.forms.getSettings(resolved.ctx))
  }

  async updateSettings(
    actor: StudioPublicFormsActor,
    input: Parameters<PublicFormsUseCase["updateSettings"]>[1]
  ): Promise<Output> {
    const resolved = await resolveCtx(actor)
    if (resolved.error) return resolved.error
    return decorateOutput(await this.forms.updateSettings(resolved.ctx, input))
  }

  async getWizardContext(actor: StudioPublicFormsActor): Promise<Output> {
    const resolved = await resolveCtx(actor)
    if (resolved.error) return resolved.error
    const [context, settingsOutput] = await Promise.all([
      backofficeStudioPublicFormsRepository.getWizardContext(resolved.ctx.teamId),
      this.forms.getSettings(resolved.ctx),
    ])
    if (!settingsOutput.isValid) return decorateOutput(settingsOutput)
    return new Output(true, [], [], {
      ...context,
      settings: settingsOutput.result,
    })
  }
}

export const backofficeStudioPublicFormsUseCase = new BackofficeStudioPublicFormsUseCase()
