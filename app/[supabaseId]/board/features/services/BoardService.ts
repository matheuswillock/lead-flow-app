import { CreateLeadRequest } from "@/app/api/v1/leads/DTO/requestToCreateLead";
import { IBoardService } from "./IBoardServices";
import { Output } from "@/lib/output";

const API_BASE_URL = '/api/v1';

export class BoardService implements IBoardService {
    updateLeadStatus(leadId: string, newStatus: string, supabaseId: string): Promise<Output> {
        return fetch(`${API_BASE_URL}/leads/${leadId}/status`, {
            method: "PUT",
            headers: {
                "Content-Type": "application/json",
                "x-supabase-user-id": supabaseId
            },
            body: JSON.stringify({ status: newStatus }),
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
    async fetchLeads(supabaseId: string, role: string): Promise<Output> {
        try {
            const searchParams = new URLSearchParams();
            searchParams.append('role', role);

            const url = `${API_BASE_URL}/leads?${searchParams.toString()}`;
            console.info('[BoardService] Fetching leads from:', url);
            console.info('[BoardService] Headers:', { supabaseId, role });

            const response = await fetch(url, {
                method: "GET",
                headers: {
                    "Content-Type": "application/json",
                    "x-supabase-user-id": supabaseId
                },
            });

            console.info('[BoardService] Response status:', response.status);
            console.info('[BoardService] Response ok:', response.ok);

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
            console.info('[BoardService] Response data:', data);

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

    async createLead(leadToCreate: CreateLeadRequest, supabaseId: string): Promise<Output> {
        try {
            const response = await fetch(`${API_BASE_URL}/leads`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "x-supabase-user-id": supabaseId
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
}

export const createBoardService = (): IBoardService => {
    return new BoardService();
}