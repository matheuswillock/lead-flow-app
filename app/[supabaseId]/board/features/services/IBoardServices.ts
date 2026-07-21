import { CreateLeadRequest } from "@/app/api/v1/leads/DTO/requestToCreateLead";
import { Output } from "@/lib/output";

export type ResendScheduleInvitePayload = {
    target: "all" | "single" | "new";
    email?: string;
    emails?: string[];
};

export type FetchLeadsOptions = {
    calendarWindowStart?: Date;
    calendarWindowEnd?: Date;
};

export interface IBoardService {
    createLead(leadToCreate: CreateLeadRequest, supabaseId: string, teamId?: string | null): Promise<Output>;
    updateLeadStatus(leadId: string, newStatus: string, supabaseId: string, teamId?: string | null): Promise<Output>;
    fetchLeads(
        supabaseId: string,
        role: string,
        teamId?: string | null,
        options?: FetchLeadsOptions
    ): Promise<Output>;
    resendScheduleInvite(
        leadId: string,
        supabaseId: string,
        payload: ResendScheduleInvitePayload,
        teamId?: string | null
    ): Promise<Output>;
}
