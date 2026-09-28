import type { TeamAccess } from "@/app/api/v1/utils/teamAccess"
import { isManagerLikeRole } from "@/lib/roles"
import { Output } from "@/lib/output"
import type { LandingPageDraftInput, LandingPageSnapshot } from "@/lib/landing-pages/types"
import type { ILandingPageRepository } from "@/app/api/infra/data/repositories/landingPages/ILandingPageRepository"
import { landingPageRepository } from "@/app/api/infra/data/repositories/landingPages/LandingPageRepository"
import type { ILandingPageUseCase } from "./ILandingPageUseCase"

function canManage(access: TeamAccess) {
  return access.isMaster || isManagerLikeRole(access.teamMember.role)
}

function validateDraft(input: LandingPageDraftInput): string[] {
  const errors: string[] = []
  if (!input.name.trim()) errors.push("Informe o nome da landing page")
  if (!input.publicFormId.trim()) errors.push("Selecione um formulário")
  if (!input.templateSlug.trim()) errors.push("Selecione um template")
  if (input.offer.enabled && input.offer.percentage !== 40) {
    errors.push("A oferta desta landing deve usar o percentual aprovado de 40%")
  }
  return errors
}

export class LandingPageUseCase implements ILandingPageUseCase {
  constructor(private readonly repository: ILandingPageRepository = landingPageRepository) {}

  async list(access: TeamAccess) {
    if (!canManage(access)) return new Output(false, [], ["Acesso negado às landing pages"], null)
    return new Output(true, [], [], await this.repository.listByTeam(access.teamId))
  }

  async get(access: TeamAccess, id: string) {
    if (!canManage(access)) return new Output(false, [], ["Acesso negado às landing pages"], null)
    const landing = await this.repository.findById(access.teamId, id)
    return landing
      ? new Output(true, [], [], landing)
      : new Output(false, [], ["Landing page não encontrada"], null)
  }

  async create(access: TeamAccess, input: LandingPageDraftInput) {
    if (!canManage(access)) return new Output(false, [], ["Acesso negado"], null)
    const errors = validateDraft(input)
    if (errors.length > 0) return new Output(false, [], errors, null)
    const form = await this.repository.findPublicFormForTeam(access.teamId, input.publicFormId)
    if (!form) return new Output(false, [], ["Formulário não encontrado neste time"], null)
    try {
      const landing = await this.repository.create({
        teamId: access.teamId,
        createdById: access.profileId,
        ...input,
      })
      return new Output(true, ["Landing page criada"], [], landing)
    } catch (error) {
      console.error("[LandingPageUseCase][create]", error)
      return new Output(false, [], ["Não foi possível criar a landing page"], null)
    }
  }

  async update(access: TeamAccess, id: string, input: LandingPageDraftInput) {
    if (!canManage(access)) return new Output(false, [], ["Acesso negado"], null)
    const errors = validateDraft(input)
    if (errors.length > 0) return new Output(false, [], errors, null)
    const form = await this.repository.findPublicFormForTeam(access.teamId, input.publicFormId)
    if (!form) return new Output(false, [], ["Formulário não encontrado neste time"], null)
    try {
      const landing = await this.repository.update(access.teamId, id, input)
      return landing
        ? new Output(true, ["Landing page atualizada"], [], landing)
        : new Output(false, [], ["Landing page não encontrada"], null)
    } catch (error) {
      console.error("[LandingPageUseCase][update]", error)
      return new Output(false, [], ["Não foi possível atualizar a landing page"], null)
    }
  }

  async publish(access: TeamAccess, id: string) {
    if (!canManage(access)) return new Output(false, [], ["Acesso negado"], null)
    const publication = await this.repository.publish(access.teamId, id, access.profileId)
    return publication
      ? new Output(true, ["Landing page publicada"], [], publication)
      : new Output(false, [], ["A landing precisa de um formulário publicado"], null)
  }

  async archive(access: TeamAccess, id: string) {
    if (!canManage(access)) return new Output(false, [], ["Acesso negado"], null)
    const landing = await this.repository.archive(access.teamId, id)
    return landing
      ? new Output(true, ["Landing page arquivada"], [], landing)
      : new Output(false, [], ["Landing page não encontrada"], null)
  }

  async getPublic(publicId: string) {
    const landing = await this.repository.findPublic(publicId)
    const publication = landing?.publications[0]
    if (!landing || !publication) return new Output(false, [], ["Landing page indisponível"], null)

    const snapshot = publication.snapshot as unknown as LandingPageSnapshot
    return new Output(true, [], [], {
      snapshot,
      teamId: landing.teamId,
      publicFormId: landing.publicFormId,
    })
  }
}

export const landingPageUseCase = new LandingPageUseCase()
