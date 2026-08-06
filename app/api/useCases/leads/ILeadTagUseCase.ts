import { Output } from "@/lib/output";

export interface ILeadTagUseCase {
  listTeamTags(teamId: string): Promise<Output>;
  createTeamTag(teamId: string, profileId: string, name: string, color: string): Promise<Output>;
  deleteTeamTag(teamId: string, tagId: string): Promise<Output>;
  listLeadTags(leadId: string, teamId: string): Promise<Output>;
  applyTagToLead(leadId: string, tagId: string, teamId: string): Promise<Output>;
  removeTagFromLead(leadId: string, tagId: string, teamId: string): Promise<Output>;
}
