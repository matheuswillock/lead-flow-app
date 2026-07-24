import type {
  BackofficeDeletionApprovalDecision,
  BackofficeDeletionRequestStatus,
  BackofficeDeletionRequestType,
} from "@prisma/client"
import { Output } from "@/lib/output"
import { createSupabaseAdmin } from "@/lib/supabase/server"
import { BackofficeDeletionRequestRepository } from "@/app/api/infra/data/repositories/backoffice/DeletionRequestRepository/BackofficeDeletionRequestRepository"
import type { IBackofficeDeletionRequestRepository } from "@/app/api/infra/data/repositories/backoffice/DeletionRequestRepository/IBackofficeDeletionRequestRepository"
import { BackofficeMemberRepository } from "@/app/api/infra/data/repositories/backoffice/MemberRepository/BackofficeMemberRepository"
import type { IBackofficeMemberRepository } from "@/app/api/infra/data/repositories/backoffice/MemberRepository/IBackofficeMemberRepository"
import {
  BACKOFFICE_DELETION_APPROVER_EMAILS,
  isBackofficeDeletionApproverEmail,
} from "./deletionApproverEmails"
import type { IBackofficeDeletionRequestUseCase } from "./IBackofficeDeletionRequestUseCase"

export class BackofficeDeletionRequestUseCase implements IBackofficeDeletionRequestUseCase {
  constructor(
    private readonly repository: IBackofficeDeletionRequestRepository = new BackofficeDeletionRequestRepository(),
    private readonly memberRepository: IBackofficeMemberRepository = new BackofficeMemberRepository()
  ) {}

  async createRequest(input: {
    type: BackofficeDeletionRequestType
    targetId: string
    reason?: string | null
    requestedByProfileId: string
  }): Promise<Output> {
    try {
      if (input.type !== "USER_DELETE" && input.type !== "TEAM_DELETE") {
        return new Output(false, [], ["Tipo de solicitação inválido"], null)
      }

      const pending = await this.repository.findPendingForTarget(input.type, input.targetId)
      if (pending) {
        return new Output(
          false,
          [],
          ["Já existe uma solicitação pendente para este alvo"],
          { id: pending.id }
        )
      }

      let snapshot: Record<string, unknown> | null = null

      if (input.type === "USER_DELETE") {
        const profile = await this.repository.findProfileSnapshot(input.targetId)
        if (!profile || profile.deletedAt) {
          return new Output(false, [], ["Usuário não encontrado ou já excluído"], null)
        }
        snapshot = {
          email: profile.email,
          fullName: profile.fullName,
          isMaster: profile.isMaster,
        }
      } else {
        const team = await this.repository.findTeamSnapshot(input.targetId)
        if (!team || team.deletedAt) {
          return new Output(false, [], ["Time não encontrado ou já excluído"], null)
        }
        snapshot = { name: team.name, masterId: team.masterId }
      }

      const created = await this.repository.create({
        type: input.type,
        targetId: input.targetId,
        requestedByProfileId: input.requestedByProfileId,
        reason: input.reason?.trim() || null,
        snapshot,
      })

      console.info("[BackofficeDeletionRequestUseCase][createRequest]", {
        id: created.id,
        type: input.type,
        targetId: input.targetId,
      })

      return new Output(
        true,
        ["Solicitação criada — pendente de 2 aprovações"],
        [],
        { id: created.id }
      )
    } catch (error) {
      console.error("[BackofficeDeletionRequestUseCase][createRequest]", error)
      return new Output(false, [], ["Erro ao criar solicitação de exclusão"], null)
    }
  }

  async listRequests(input?: { status?: string }): Promise<Output> {
    try {
      const status =
        input?.status && ["pending", "approved", "rejected", "cancelled"].includes(input.status)
          ? (input.status as BackofficeDeletionRequestStatus)
          : undefined

      const items = await this.repository.list({ status })
      return new Output(true, ["Solicitações carregadas"], [], { items })
    } catch (error) {
      console.error("[BackofficeDeletionRequestUseCase][listRequests]", error)
      return new Output(false, [], ["Erro ao listar solicitações"], null)
    }
  }

  async decide(input: {
    requestId: string
    decision: BackofficeDeletionApprovalDecision
    approverProfileId: string
    approverEmail: string
  }): Promise<Output> {
    try {
      if (!isBackofficeDeletionApproverEmail(input.approverEmail)) {
        return new Output(
          false,
          [],
          ["Apenas aprovadores autorizados podem decidir esta solicitação"],
          null
        )
      }

      if (input.decision !== "approved" && input.decision !== "rejected") {
        return new Output(false, [], ["Decisão inválida"], null)
      }

      const request = await this.repository.findById(input.requestId)
      if (!request) {
        return new Output(false, [], ["Solicitação não encontrada"], null)
      }
      if (request.status !== "pending") {
        return new Output(false, [], ["Solicitação já foi finalizada"], null)
      }

      const already = request.approvals.find((a) => a.approverProfileId === input.approverProfileId)
      if (already) {
        return new Output(false, [], ["Você já registrou uma decisão nesta solicitação"], null)
      }

      await this.repository.createApproval({
        requestId: input.requestId,
        approverProfileId: input.approverProfileId,
        decision: input.decision,
      })

      if (input.decision === "rejected") {
        await this.repository.updateStatus(input.requestId, "rejected")
        return new Output(true, ["Solicitação rejeitada"], [], { id: input.requestId, status: "rejected" })
      }

      const refreshed = await this.repository.findById(input.requestId)
      if (!refreshed) {
        return new Output(false, [], ["Solicitação não encontrada após aprovação"], null)
      }

      const approvedEmails = new Set(
        refreshed.approvals
          .filter((a) => a.decision === "approved" && a.approverEmail)
          .map((a) => a.approverEmail!.trim().toLowerCase())
      )

      const requiredOk = BACKOFFICE_DELETION_APPROVER_EMAILS.every((email) =>
        approvedEmails.has(email)
      )

      if (!requiredOk) {
        return new Output(
          true,
          ["Aprovação registrada — aguardando o segundo aprovador"],
          [],
          { id: input.requestId, status: "pending", approvals: refreshed.approvals.length }
        )
      }

      await this.executeApprovedRequest(refreshed.type, refreshed.targetId, input.approverProfileId, input.requestId)
      await this.repository.updateStatus(input.requestId, "approved", new Date())

      return new Output(
        true,
        ["Solicitação aprovada e exclusão lógica executada"],
        [],
        { id: input.requestId, status: "approved" }
      )
    } catch (error) {
      console.error("[BackofficeDeletionRequestUseCase][decide]", error)
      return new Output(false, [], ["Erro ao processar decisão"], null)
    }
  }

  private async executeApprovedRequest(
    type: BackofficeDeletionRequestType,
    targetId: string,
    actorProfileId: string,
    requestId: string
  ): Promise<void> {
    if (type === "USER_DELETE") {
      const member = await this.memberRepository.findMemberForDeletion(targetId)
      await this.memberRepository.softDeleteMemberCascade(targetId, actorProfileId, requestId)

      if (member?.supabaseId) {
        try {
          const supabase = createSupabaseAdmin()
          if (supabase) {
            await supabase.auth.admin.updateUserById(member.supabaseId, {
              ban_duration: "876000h",
            })
          }
        } catch (authError) {
          console.error(
            "[BackofficeDeletionRequestUseCase][executeApprovedRequest] Falha ao desativar Auth:",
            authError
          )
        }
      }
      return
    }

    await this.memberRepository.softDeleteTeamCascade(targetId, actorProfileId, requestId)
  }
}

export const backofficeDeletionRequestUseCase = new BackofficeDeletionRequestUseCase()
