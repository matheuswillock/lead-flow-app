import { LeadRepository } from "@/app/api/infra/data/repositories/lead/LeadRepository";
import { LeadUseCase } from "@/app/api/useCases/leads/LeadUseCase";
import { RegisterNewUserProfile } from "@/app/api/useCases/profiles/ProfileUseCase";

const leadRepository = new LeadRepository();
const profileUseCase = new RegisterNewUserProfile();

export const leadUseCase = new LeadUseCase(leadRepository, profileUseCase);
