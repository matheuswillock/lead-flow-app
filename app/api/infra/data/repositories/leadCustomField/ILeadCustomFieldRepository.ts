import type { LeadCustomFieldDefinition, LeadCustomFieldType, Prisma } from "@prisma/client";
import type { TeamAccess } from "@/app/api/v1/utils/teamAccess";
import {
  type LeadCustomFieldDefinitionDTO,
  parseLeadCustomFieldOptions,
} from "@/lib/leadCustomFields/types";

export type LeadCustomFieldDefinitionRecord = Pick<
  LeadCustomFieldDefinition,
  | "id"
  | "teamId"
  | "key"
  | "label"
  | "type"
  | "options"
  | "isRequired"
  | "displayOrder"
  | "isActive"
  | "showOnPublicForm"
  | "createdAt"
  | "updatedAt"
>;

export type LeadCustomFieldDefinitionCreateInput = {
  key?: string;
  label: string;
  type: LeadCustomFieldType;
  options?: Prisma.InputJsonValue | null;
  isRequired?: boolean;
  displayOrder?: number;
  showOnPublicForm?: boolean;
};

export type LeadCustomFieldDefinitionUpdateInput = {
  label?: string;
  options?: Prisma.InputJsonValue | null;
  isRequired?: boolean;
  displayOrder?: number;
  isActive?: boolean;
  showOnPublicForm?: boolean;
};

export interface ILeadCustomFieldRepository {
  listByTeamWithCtx(access: TeamAccess, includeInactive?: boolean): Promise<LeadCustomFieldDefinitionRecord[]>;
  findByIdWithCtx(access: TeamAccess, definitionId: string): Promise<LeadCustomFieldDefinitionRecord | null>;
  countActiveByTeamWithCtx(access: TeamAccess): Promise<number>;
  createWithCtx(
    access: TeamAccess,
    input: LeadCustomFieldDefinitionCreateInput & { key: string }
  ): Promise<LeadCustomFieldDefinitionRecord>;
  updateWithCtx(
    access: TeamAccess,
    definitionId: string,
    input: LeadCustomFieldDefinitionUpdateInput
  ): Promise<LeadCustomFieldDefinitionRecord | null>;
  countValuesByDefinitionId(definitionId: string): Promise<number>;
  deleteDefinition(definitionId: string): Promise<void>;
  listActiveByTeamId(teamId: string): Promise<LeadCustomFieldDefinitionRecord[]>;
  listActivePublicByTeamId(teamId: string): Promise<LeadCustomFieldDefinitionRecord[]>;
  listValuesByLeadId(leadId: string): Promise<
    Array<{
      definitionId: string;
      value: Prisma.JsonValue;
      definition: LeadCustomFieldDefinitionRecord;
    }>
  >;
  upsertValuesForLead(
    leadId: string,
    entries: Array<{ definitionId: string; value: Prisma.InputJsonValue }>
  ): Promise<void>;
}

export function mapLeadCustomFieldDefinitionToDTO(
  definition: LeadCustomFieldDefinitionRecord
): LeadCustomFieldDefinitionDTO {
  return {
    id: definition.id,
    teamId: definition.teamId,
    key: definition.key,
    label: definition.label,
    type: definition.type,
    options: parseLeadCustomFieldOptions(definition.options),
    isRequired: definition.isRequired,
    displayOrder: definition.displayOrder,
    isActive: definition.isActive,
    showOnPublicForm: definition.showOnPublicForm,
    createdAt: definition.createdAt.toISOString(),
    updatedAt: definition.updatedAt.toISOString(),
  };
}
