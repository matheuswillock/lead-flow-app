import { CreateLeadRequest } from "@/app/api/v1/leads/DTO/requestToCreateLead";
import { Output } from "@/lib/output";

export interface IBoardService {
    createLead(leadToCreate: CreateLeadRequest, supabaseId: string, teamId?: string | null): Promise<Output>;
    updateLeadStatus(leadId: string, newStatus: string, supabaseId: string, teamId?: string | null): Promise<Output>;
    fetchLeads(supabaseId: string, role: string, teamId?: string | null): Promise<Output>;
}
