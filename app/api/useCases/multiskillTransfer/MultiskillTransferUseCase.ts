import { LeadStatus } from "@prisma/client";
import { leadRepository } from "@/app/api/infra/data/repositories/lead/LeadRepository";
import {
  multiskillTransferRepository,
  type MultiskillTransferRepository,
} from "@/app/api/infra/data/repositories/multiskillTransfer/MultiskillTransferRepository";
import { backofficeOperationalAccessService } from "@/app/api/services/backofficeOperationalAccess/BackofficeOperationalAccessService";
import type { IMultiskillTransferService } from "@/app/api/services/multiskillTransfer/IMultiskillTransferService";
import { multiskillTransferService } from "@/app/api/services/multiskillTransfer/MultiskillTransferService";
import type { TeamAccess } from "@/app/api/v1/utils/teamAccess";
import type { TransferMultiskillLeadRequest } from "@/app/api/v1/leads/DTO/requestToTransferMultiskillLead";
import { Output } from "@/lib/output";
import {
  isMultiskillOriginMaster,
  resolveMultiskillOriginMasterId,
} from "@/lib/multiskill/is-multiskill-origin-master";
import type { IMultiskillTransferUseCase } from "./IMultiskillTransferUseCase";

export class MultiskillTransferUseCase implements IMultiskillTransferUseCase {
  constructor(
    private readonly service: IMultiskillTransferService = multiskillTransferService,
    private readonly repository: MultiskillTransferRepository = multiskillTransferRepository
  ) {}

  private async assertMultiskillCaller(ctx: TeamAccess): Promise<{ originMasterId: string }> {
    const originMasterId = await resolveMultiskillOriginMasterId();
    if (!isMultiskillOriginMaster(ctx, originMasterId)) {
      throw new Error("Acesso negado: conta não autorizada para transferência externa MultiSkill");
    }
    await backofficeOperationalAccessService.assertMultiskillOriginTeam(ctx.teamId);
    return { originMasterId: ctx.managerId };
  }

  async listTransferTargets(
    ctx: TeamAccess,
    input: { query?: string; page: number; pageSize: number }
  ): Promise<Output> {
    try {
      const { originMasterId } = await this.assertMultiskillCaller(ctx);
      const result = await this.service.listTransferTargets({
        originMasterId,
        query: input.query,
        page: input.page,
        pageSize: input.pageSize,
      });
      return new Output(true, [], [], result);
    } catch (error) {
      console.error("[MultiskillTransferUseCase][listTransferTargets]", error);
      const message = error instanceof Error ? error.message : "Erro ao listar destinos MultiSkill";
      return new Output(false, [], [message], null);
    }
  }

  async transferLead(
    ctx: TeamAccess,
    leadId: string,
    data: TransferMultiskillLeadRequest
  ): Promise<Output> {
    try {
      const { originMasterId } = await this.assertMultiskillCaller(ctx);

      if (!ctx.isMaster) {
        const membership = await this.repository.findTransferDelegationMembership(
          ctx.teamId,
          ctx.profileId
        );

        const canTransfer =
          (membership?.role === "manager" || membership?.role === "backoffice") &&
          membership.canTransferAccountLeads === true;

        if (!canTransfer) {
          return new Output(
            false,
            [],
            ["Acesso negado: delegação de transferência de leads é obrigatória."],
            null
          );
        }
      }

      const lead = await this.repository.findLeadForMultiskillTransfer(leadId);
      if (!lead) {
        return new Output(false, [], ["Lead não encontrado"], null);
      }

      if (lead.status !== LeadStatus.new_opportunity) {
        return new Output(
          false,
          [],
          ["O lead só pode ser transferido quando estiver com o status Nova Oportunidade"],
          null
        );
      }

      if (lead.managerId !== originMasterId) {
        return new Output(false, [], ["Lead não pertence à conta de origem MultiSkill"], null);
      }

      const targetMaster = await this.repository.findMasterMultiskillProfile(data.targetMasterId);

      if (!targetMaster || targetMaster.id === originMasterId) {
        return new Output(false, [], ["Master destino inválido ou indisponível para MultiSkill"], null);
      }

      const defaultTeam = await this.service.resolveDefaultTeamForMaster(targetMaster.id);
      if (!defaultTeam) {
        return new Output(false, [], ["Master destino não possui time padrão configurado"], null);
      }

      const closerValid = await this.repository.findCloserOnDefaultTeam({
        defaultTeamId: defaultTeam.id,
        closerId: data.closerId,
        masterId: targetMaster.id,
      });

      if (!closerValid) {
        return new Output(
          false,
          [],
          ["O closer selecionado não pertence ao time padrão destino ou não possui função CLOSER"],
          null
        );
      }

      if (data.sdrId) {
        const sdrValid = await this.repository.findSdrOnDefaultTeam({
          defaultTeamId: defaultTeam.id,
          sdrId: data.sdrId,
          masterId: targetMaster.id,
        });
        if (!sdrValid) {
          return new Output(
            false,
            [],
            ["O SDR selecionado não pertence ao time padrão destino ou não possui função SDR"],
            null
          );
        }
      }

      if (!lead.teamId) {
        return new Output(false, [], ["Lead sem time de origem"], null);
      }

      const conflictResolution = await this.repository.resolveTransferTeamUniqueConflicts(
        lead,
        defaultTeam.id
      );
      if (!conflictResolution.ok) {
        return new Output(false, [], [conflictResolution.message], null);
      }

      const transferredLead = await leadRepository.transferToTeam(
        leadId,
        defaultTeam.id,
        data.closerId,
        data.sdrId ?? null,
        conflictResolution.sanitizations,
        { targetManagerId: targetMaster.id }
      );

      await this.repository.clearLeadTransferFlag(transferredLead.id);

      await this.repository.createMultiskillLeadTransfer({
        leadId: transferredLead.id,
        fromTeamId: lead.teamId,
        toTeamId: defaultTeam.id,
        transferredByProfileId: ctx.profileId,
        receivedByProfileId: data.closerId,
        fromManagerId: originMasterId,
        toManagerId: targetMaster.id,
        transferTagUsed: lead.isTransfer === true,
        preScheduledAt: lead.meetingDate ?? null,
      });

      const finalLead = await leadRepository.findById(transferredLead.id);

      return new Output(true, ["Lead transferido via MultiSkill com sucesso"], [], finalLead);
    } catch (error) {
      console.error("[MultiskillTransferUseCase][transferLead]", error);
      const message = error instanceof Error ? error.message : "Erro ao transferir lead via MultiSkill";
      return new Output(false, [], [message], null);
    }
  }
}

export const multiskillTransferUseCase = new MultiskillTransferUseCase();
