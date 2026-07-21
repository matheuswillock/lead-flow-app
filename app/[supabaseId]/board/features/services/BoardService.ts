import { CreateLeadRequest } from "@/app/api/v1/leads/DTO/requestToCreateLead";
import { IBoardService, type FetchLeadsOptions, type ResendScheduleInvitePayload } from "./IBoardServices";
import { Output } from "@/lib/output";

const API_BASE_URL = '/api/v1';

export class BoardService implements IBoardService {
    updateLeadStatus(leadId: string, newStatus: string, supabaseId: string, teamId?: string | null): Promise<Output> {
        return fetch(`${API_BASE_URL}/leads/${leadId}/status-transition`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "x-supabase-user-id": supabaseId,
                ...(teamId ? { "x-team-id": teamId } : {})
            },
            body: JSON.stringify({ mode: "apply", targetStatus: newStatus }),
        })
        .then(response => response.json())
        .then(data => data as Output)
        .catch(error => {
            console.error("Error updating lead status:", error);
            return new Output(
                false,
                [],
                ["Ocorreu um erro ao atualizar o status do lead. Tente novamente mais tarde."],
                null
            );
        });
    }
    async fetchLeads(
        supabaseId: string,
        role: string,
        teamId?: string | null,
        options?: FetchLeadsOptions
    ): Promise<Output> {
        try {
            const searchParams = new URLSearchParams();
            searchParams.append('role', role);
            if (teamId) {
                searchParams.append('teamId', teamId);
            }
            if (options?.calendarWindowStart && options?.calendarWindowEnd) {
                searchParams.append('calendarWindowStart', options.calendarWindowStart.toISOString());
                searchParams.append('calendarWindowEnd', options.calendarWindowEnd.toISOString());
            }

            const url = `${API_BASE_URL}/leads?${searchParams.toString()}`;

            const response = await fetch(url, {
                method: "GET",
                headers: {
                    "Content-Type": "application/json",
                    "x-supabase-user-id": supabaseId,
                    ...(teamId ? { "x-team-id": teamId } : {})
                },
            });

            // Check if response is ok before parsing
            if (!response.ok) {
                const errorText = await response.text();
                console.error('[BoardService] Error response:', errorText);
                return new Output(
                    false,
                    [],
                    [`Erro ao carregar leads: ${response.status} - ${errorText}`],
                    null
                );
            }

            const data = await response.json();

            return data as Output;
            
        } catch (error) {
            console.error("[BoardService] Error fetching leads:", error);

            return new Output(
                false,
                [],
                ["Ocorreu um erro ao carregar os leads. Tente novamente mais tarde."],
                null
            );
        }
    }

    async createLead(leadToCreate: CreateLeadRequest, supabaseId: string, teamId?: string | null): Promise<Output> {
        try {
            const response = await fetch(`${API_BASE_URL}/leads`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "x-supabase-user-id": supabaseId,
                    ...(teamId ? { "x-team-id": teamId } : {})
                },
                body: JSON.stringify(leadToCreate),
            });

            const data = await response.json();

            return data as Output;
            
        } catch (error) {
            console.error("Error creating lead:", error);

            return new Output(
                false,
                [],
                ["Ocorreu um erro. Tente novamente mais tarde."],
                null
            );
        }
    }

    async resendScheduleInvite(
        leadId: string,
        supabaseId: string,
        payload: ResendScheduleInvitePayload,
        teamId?: string | null
    ): Promise<Output> {
        try {
            const response = await fetch(`${API_BASE_URL}/leads/${leadId}/schedule/resend`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "x-supabase-user-id": supabaseId,
                    ...(teamId ? { "x-team-id": teamId } : {}),
                },
                body: JSON.stringify(payload),
            });

            if (!response.ok) {
                const errorText = await response.text();
                console.error("[BoardService] resendScheduleInvite error:", errorText);
                return new Output(
                    false,
                    [],
                    [`Erro ao reenviar convite: ${response.status}`],
                    null
                );
            }

            return (await response.json()) as Output;
        } catch (error) {
            console.error("[BoardService] resendScheduleInvite:", error);
            return new Output(
                false,
                [],
                ["Ocorreu um erro ao reenviar o convite. Tente novamente mais tarde."],
                null
            );
        }
    }
}

export const createBoardService = (): IBoardService => {
    return new BoardService();
}
