import { CreateLeadRequest } from "@/app/api/v1/leads/DTO/requestToCreateLead";
import { Output } from "@/lib/output";

export interface IBoardService {
    createLead(leadToCreate: CreateLeadRequest): Promise<Output>;
}