import { Output } from "@/lib/output";
import type { TeamAccess } from "@/app/api/v1/utils/teamAccess";
import type { LeadCustomFieldType } from "@prisma/client";
import {
  mapLeadCustomFieldDefinitionToDTO,
  type LeadCustomFieldDefinitionCreateInput,
  type LeadCustomFieldDefinitionUpdateInput,
} from "@/app/api/infra/data/repositories/leadCustomField/ILeadCustomFieldRepository";
import type { ILeadCustomFieldService } from "@/app/api/services/leadCustomField/ILeadCustomFieldService";
import { leadCustomFieldService } from "@/app/api/services/leadCustomField/LeadCustomFieldService";
import {
  MAX_ACTIVE_LEAD_CUSTOM_FIELD_DEFINITIONS,
  slugifyLeadCustomFieldKey,
} from "@/lib/leadCustomFields/types";

export interface ILeadCustomFieldsUseCase {
  listDefinitions(access: TeamAccess, includeInactive?: boolean): Promise<Output>;
  createDefinition(access: TeamAccess, input: LeadCustomFieldDefinitionCreateInput): Promise<Output>;
  updateDefinition(
    access: TeamAccess,
    definitionId: string,
    input: LeadCustomFieldDefinitionUpdateInput
  ): Promise<Output>;
  deleteDefinition(access: TeamAccess, definitionId: string): Promise<Output>;
}

export class LeadCustomFieldsUseCase implements ILeadCustomFieldsUseCase {
  constructor(private service: ILeadCustomFieldService = leadCustomFieldService) {}

  async listDefinitions(access: TeamAccess, includeInactive = false): Promise<Output> {
    const definitions = await this.service.listDefinitions(access, includeInactive);
    return new Output(
      true,
      [],
      [],
      definitions.map(mapLeadCustomFieldDefinitionToDTO)
    );
  }

  async createDefinition(access: TeamAccess, input: LeadCustomFieldDefinitionCreateInput): Promise<Output> {
    const key = (input.key?.trim() || slugifyLeadCustomFieldKey(input.label));
    const result = await this.service.createDefinition(access, {
      ...input,
      key,
      label: input.label.trim(),
    });

    if ("error" in result) {
      if (result.error === "max_active") {
        return new Output(
          false,
          [],
          [`Limite de ${MAX_ACTIVE_LEAD_CUSTOM_FIELD_DEFINITIONS} campos ativos por time atingido`],
          null
        );
      }
      if (result.error === "duplicate_key") {
        return new Output(false, [], ["Já existe um campo com esta chave neste time"], null);
      }
      if (result.error === "invalid_options") {
        return new Output(false, [], ["Campos do tipo seleção precisam de opções válidas"], null);
      }
    }

    return new Output(
      true,
      ["Campo personalizado criado com sucesso"],
      [],
      mapLeadCustomFieldDefinitionToDTO(result.definition)
    );
  }

  async updateDefinition(
    access: TeamAccess,
    definitionId: string,
    input: LeadCustomFieldDefinitionUpdateInput
  ): Promise<Output> {
    const result = await this.service.updateDefinition(access, definitionId, input);
    if ("error" in result) {
      if (result.error === "not_found") {
        return new Output(false, [], ["Campo personalizado não encontrado"], null);
      }
      if (result.error === "invalid_options") {
        return new Output(false, [], ["Campos do tipo seleção precisam de opções válidas"], null);
      }
    }

    return new Output(
      true,
      ["Campo personalizado atualizado com sucesso"],
      [],
      mapLeadCustomFieldDefinitionToDTO(result.definition)
    );
  }

  async deleteDefinition(access: TeamAccess, definitionId: string): Promise<Output> {
    const result = await this.service.deleteDefinition(access, definitionId);
    if (!result.removed) {
      return new Output(false, [], ["Campo personalizado não encontrado"], null);
    }

    return new Output(
      true,
      [result.softDeleted ? "Campo personalizado desativado" : "Campo personalizado removido"],
      [],
      { softDeleted: result.softDeleted === true }
    );
  }
}

export const leadCustomFieldsUseCase = new LeadCustomFieldsUseCase();

export type LeadCustomFieldDefinitionInput = {
  label: string;
  key?: string;
  type: LeadCustomFieldType;
  options?: Array<{ value: string; label: string }>;
  isRequired?: boolean;
  displayOrder?: number;
};
