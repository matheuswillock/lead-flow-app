import type { BackofficeLeadStatus } from "@prisma/client";
import { Output } from "@/lib/output";
import {
  backofficeCrmLeadStatusTransitionFieldRuleRepository,
  type CrmLeadStatusTransitionRuleRow,
} from "@/app/api/infra/data/repositories/backoffice/backofficeCrmLeadStatusTransitionFieldRule/BackofficeCrmLeadStatusTransitionFieldRuleRepository";
import {
  isLeadTransitionFieldKey,
  LEAD_TRANSITION_FIELD_KEYS,
  type LeadTransitionFieldKey,
} from "@/lib/leadStatusTransitionFields";

export type BackofficeCrmLeadStatusTransitionRuleDTO = {
  targetStatus: BackofficeLeadStatus;
  fieldKeys: LeadTransitionFieldKey[];
};

export class BackofficeCrmLeadStatusTransitionRuleUseCase {
  async list(): Promise<Output> {
    try {
      const rules =
        await backofficeCrmLeadStatusTransitionFieldRuleRepository.listGroupedByTargetStatus();
      return new Output(true, [], [], {
        rules,
        availableFieldKeys: LEAD_TRANSITION_FIELD_KEYS,
      });
    } catch (error) {
      console.error("[BackofficeCrmLeadStatusTransitionRuleUseCase][list]", error);
      return new Output(false, [], ["Erro ao listar regras de transição do CRM"], null);
    }
  }

  async replaceAll(
    rules: BackofficeCrmLeadStatusTransitionRuleDTO[],
    updatedByProfileId: string
  ): Promise<Output> {
    try {
      const normalized = this.normalizeRules(rules);
      await backofficeCrmLeadStatusTransitionFieldRuleRepository.replaceAllRules(
        normalized,
        updatedByProfileId
      );

      const saved =
        await backofficeCrmLeadStatusTransitionFieldRuleRepository.listGroupedByTargetStatus();
      return new Output(true, ["Regras de transição salvas com sucesso"], [], {
        rules: saved,
        availableFieldKeys: LEAD_TRANSITION_FIELD_KEYS,
      });
    } catch (error) {
      console.error("[BackofficeCrmLeadStatusTransitionRuleUseCase][replaceAll]", error);
      return new Output(false, [], ["Erro ao salvar regras de transição"], null);
    }
  }

  async replaceForTargetStatus(
    targetStatus: BackofficeLeadStatus,
    fieldKeys: LeadTransitionFieldKey[],
    updatedByProfileId: string
  ): Promise<Output> {
    try {
      const safeFieldKeys = this.normalizeFieldKeys(fieldKeys);
      await backofficeCrmLeadStatusTransitionFieldRuleRepository.replaceRulesForTargetStatus(
        targetStatus,
        safeFieldKeys,
        updatedByProfileId
      );

      const saved =
        await backofficeCrmLeadStatusTransitionFieldRuleRepository.listGroupedByTargetStatus();
      return new Output(true, ["Regras de transição salvas com sucesso"], [], {
        rules: saved,
        availableFieldKeys: LEAD_TRANSITION_FIELD_KEYS,
      });
    } catch (error) {
      console.error("[BackofficeCrmLeadStatusTransitionRuleUseCase][replaceForTargetStatus]", error);
      return new Output(false, [], ["Erro ao salvar regras de transição"], null);
    }
  }

  private normalizeRules(rules: BackofficeCrmLeadStatusTransitionRuleDTO[]) {
    const map = new Map<BackofficeLeadStatus, LeadTransitionFieldKey[]>();

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

export const backofficeCrmLeadStatusTransitionRuleUseCase =
  new BackofficeCrmLeadStatusTransitionRuleUseCase();

export type { CrmLeadStatusTransitionRuleRow };
