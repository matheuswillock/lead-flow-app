import { CreateLeadRequest } from "@/app/api/v1/leads/DTO/requestToCreateLead";
import { IBoardService } from "./IBoardServices";
import { Output } from "@/lib/output";

export class BoardService implements IBoardService {
    async createLead(leadToCreate: CreateLeadRequest): Promise<Output> {
        try {
            const response = await fetch("/api/v1/leads", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
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