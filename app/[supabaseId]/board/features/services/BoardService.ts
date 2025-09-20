import { CreateLeadRequest } from "@/app/api/v1/leads/DTO/requestToCreateLead";
import { IBoardService } from "./IBoardServices";
import { Output } from "@/lib/output";

export class BoardService implements IBoardService {
    async fetchLeads(supabaseId: string, role: string): Promise<Output> {
        try {
            const searchParams = new URLSearchParams();
            searchParams.append('role', role);
            
            const response = await fetch(`/api/v1/leads?${searchParams.toString()}`, {
                method: "GET",
                headers: {
                    "Content-Type": "application/json",
                    "x-supabase-user-id": supabaseId
                },
            });

            const data = await response.json();

            return data as Output;
            
        } catch (error) {
            console.error("Error fetching leads:", error);

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
            const response = await fetch("/api/v1/leads", {
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