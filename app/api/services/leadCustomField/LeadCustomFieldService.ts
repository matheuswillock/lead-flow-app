import { validateLeadCustomFieldsPayload } from "@/lib/leadCustomFields/schema";
import {
  MAX_ACTIVE_LEAD_CUSTOM_FIELD_DEFINITIONS,
} from "@/lib/leadCustomFields/types";
import type { TeamAccess } from "@/app/api/v1/utils/teamAccess";
import {
  type ILeadCustomFieldRepository,
  mapLeadCustomFieldDefinitionToDTO,
} from "@/app/api/infra/data/repositories/leadCustomField/ILeadCustomFieldRepository";
import { leadCustomFieldRepository } from "@/app/api/infra/data/repositories/leadCustomField/LeadCustomFieldRepository";
import type {
  ILeadCustomFieldService,
} from "./ILeadCustomFieldService";
import type {
  LeadCustomFieldDefinitionCreateInput,
  LeadCustomFieldDefinitionUpdateInput,
} from "@/app/api/infra/data/repositories/leadCustomField/ILeadCustomFieldRepository";
import { isValidLeadCustomFieldKey, validateOptionsForType } from "./ILeadCustomFieldService";

export class LeadCustomFieldService implements ILeadCustomFieldService {
  constructor(private repository: ILeadCustomFieldRepository = leadCustomFieldRepository) {}

  async listDefinitions(access: TeamAccess, includeInactive = false) {
    return this.repository.listByTeamWithCtx(access, includeInactive);
  }

  async createDefinition(access: TeamAccess, input: LeadCustomFieldDefinitionCreateInput) {
    if (!isValidLeadCustomFieldKey(input.key)) {
      return { error: "duplicate_key" as const };
    }
    if (!validateOptionsForType(input.type, input.options)) {
      return { error: "invalid_options" as const };
    }

    const activeCount = await this.repository.countActiveByTeamWithCtx(access);
    if (activeCount >= MAX_ACTIVE_LEAD_CUSTOM_FIELD_DEFINITIONS) {
      return { error: "max_active" as const };
    }

    try {
      const definition = await this.repository.createWithCtx(access, input);
      return { definition };
    } catch (error) {
      if (error instanceof Error && error.message.includes("Unique constraint")) {
        return { error: "duplicate_key" as const };
      }
      throw error;
    }
  }

  async updateDefinition(
    access: TeamAccess,
    definitionId: string,
    input: LeadCustomFieldDefinitionUpdateInput
  ) {
    const existing = await this.repository.findByIdWithCtx(access, definitionId);
    if (!existing) {
      return { error: "not_found" as const };
    }

    const nextType = existing.type;
    const nextOptions = input.options !== undefined ? input.options : existing.options;
    if (!validateOptionsForType(nextType, nextOptions)) {
      return { error: "invalid_options" as const };
    }

    const definition = await this.repository.updateWithCtx(access, definitionId, input);
    if (!definition) {
      return { error: "not_found" as const };
    }
    return { definition };
  }

  async deleteDefinition(access: TeamAccess, definitionId: string) {
    const existing = await this.repository.findByIdWithCtx(access, definitionId);
    if (!existing) {
      return { removed: false, error: "not_found" as const };
    }

    const valueCount = await this.repository.countValuesByDefinitionId(definitionId);
    if (valueCount > 0) {
      await this.repository.updateWithCtx(access, definitionId, { isActive: false });
      return { removed: true, softDeleted: true };
    }

    await this.repository.deleteDefinition(definitionId);
    return { removed: true, softDeleted: false };
  }

  async listActiveDefinitionsByTeamId(teamId: string) {
    return this.repository.listActiveByTeamId(teamId);
  }

  async persistLeadCustomFieldValues(input: {
    teamId: string;
    leadId: string;
    customFields?: Record<string, unknown>;
    enforceRequired: boolean;
  }) {
    const definitions = await this.repository.listActiveByTeamId(input.teamId);
    const definitionDtos = definitions.map(mapLeadCustomFieldDefinitionToDTO);
    const validation = validateLeadCustomFieldsPayload(
      definitionDtos,
      input.customFields,
      input.enforceRequired
    );
    if (!validation.success) {
      return { success: false as const, errors: validation.errors };
    }

    if (!input.customFields) {
      return { success: true as const };
    }

    const definitionByKey = new Map(definitions.map((definition) => [definition.key, definition]));
    const entries = Object.entries(input.customFields)
      .filter(([key]) => definitionByKey.has(key))
      .map(([key, value]) => ({
        definitionId: definitionByKey.get(key)!.id,
        value: value as never,
      }));

    await this.repository.upsertValuesForLead(input.leadId, entries);
    return { success: true as const };
  }

  async getLeadCustomFieldValues(leadId: string) {
    const rows = await this.repository.listValuesByLeadId(leadId);
    return rows
      .filter((row) => row.definition.isActive)
      .sort((a, b) => a.definition.displayOrder - b.definition.displayOrder)
      .map((row) => ({
        key: row.definition.key,
        label: row.definition.label,
        type: row.definition.type,
        value: row.value,
        isRequired: row.definition.isRequired,
      }));
  }
}

export const leadCustomFieldService = new LeadCustomFieldService();
