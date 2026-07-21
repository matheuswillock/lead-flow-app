import type { LeadStatus } from "@prisma/client";
import { Output } from "@/lib/output";
import type { IBackofficeLeadStatusTransitionRuleUseCase } from "./IBackofficeLeadStatusTransitionRuleUseCase";
import {
  backofficeLeadStatusTransitionRuleRepository,
  type LeadStatusTransitionRuleRow,
} from "@/app/api/infra/data/repositories/backofficeLeadStatusTransitionRule/BackofficeLeadStatusTransitionRuleRepository";
import {
  isLeadTransitionFieldKey,
  LEAD_TRANSITION_FIELD_KEYS,
  type LeadTransitionFieldKey,
} from "@/lib/leadStatusTransitionFields";
import { invalidateLeadStatusTransitionFieldRulesCache } from "@/lib/cache/invalidation";

export type BackofficeLeadStatusTransitionRuleDTO = {
  targetStatus: LeadStatus;
  fieldKeys: LeadTransitionFieldKey[];
};

export class BackofficeLeadStatusTransitionRuleUseCase
  implements IBackofficeLeadStatusTransitionRuleUseCase
{
  async list(): Promise<Output> {
    try {
      const rules = await backofficeLeadStatusTransitionRuleRepository.listGroupedByTargetStatus();
      return new Output(true, [], [], {
        rules,
        availableFieldKeys: LEAD_TRANSITION_FIELD_KEYS,
      });
    } catch (error) {
      console.error("[BackofficeLeadStatusTransitionRuleUseCase][list]", error);
      return new Output(false, [], ["Erro ao listar regras de transição"], null);
    }
  }

  async replaceAll(
    rules: BackofficeLeadStatusTransitionRuleDTO[],
    updatedByProfileId: string
  ): Promise<Output> {
    try {
      const normalized = this.normalizeRules(rules);
      await backofficeLeadStatusTransitionRuleRepository.replaceAllRules(
        normalized,
        updatedByProfileId
      );
      invalidateLeadStatusTransitionFieldRulesCache();

      const saved = await backofficeLeadStatusTransitionRuleRepository.listGroupedByTargetStatus();
      return new Output(true, ["Regras de transição salvas com sucesso"], [], {
        rules: saved,
        availableFieldKeys: LEAD_TRANSITION_FIELD_KEYS,
      });
    } catch (error) {
      console.error("[BackofficeLeadStatusTransitionRuleUseCase][replaceAll]", error);
      return new Output(false, [], ["Erro ao salvar regras de transição"], null);
    }
  }

  async replaceForTargetStatus(
    targetStatus: LeadStatus,
    fieldKeys: LeadTransitionFieldKey[],
    updatedByProfileId: string
  ): Promise<Output> {
    try {
      const safeFieldKeys = this.normalizeFieldKeys(fieldKeys);
      await backofficeLeadStatusTransitionRuleRepository.replaceRulesForTargetStatus(
        targetStatus,
        safeFieldKeys,
        updatedByProfileId
      );
      invalidateLeadStatusTransitionFieldRulesCache();

      const saved = await backofficeLeadStatusTransitionRuleRepository.listGroupedByTargetStatus();
      return new Output(true, ["Regras de transição salvas com sucesso"], [], {
        rules: saved,
        availableFieldKeys: LEAD_TRANSITION_FIELD_KEYS,
      });
    } catch (error) {
      console.error("[BackofficeLeadStatusTransitionRuleUseCase][replaceForTargetStatus]", error);
      return new Output(false, [], ["Erro ao salvar regras de transição"], null);
    }
  }

  private normalizeRules(rules: BackofficeLeadStatusTransitionRuleDTO[]) {
    const map = new Map<LeadStatus, LeadTransitionFieldKey[]>();

    for (const rule of rules) {
      if (!rule?.targetStatus) continue;
      map.set(rule.targetStatus, this.normalizeFieldKeys(rule.fieldKeys ?? []));
    }

    return Array.from(map.entries()).map(([targetStatus, fieldKeys]) => ({
      targetStatus,
      fieldKeys,
    }));
  }

  private normalizeFieldKeys(fieldKeys: string[]): LeadTransitionFieldKey[] {
    const unique = new Set<LeadTransitionFieldKey>();
    for (const key of fieldKeys) {
      if (isLeadTransitionFieldKey(key)) {
        unique.add(key);
      }
    }
    return Array.from(unique);
  }
}

export const backofficeLeadStatusTransitionRuleUseCase =
  new BackofficeLeadStatusTransitionRuleUseCase();

export type { LeadStatusTransitionRuleRow };
