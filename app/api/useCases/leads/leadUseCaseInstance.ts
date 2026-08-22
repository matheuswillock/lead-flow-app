import { LeadRepository } from "@/app/api/infra/data/repositories/lead/LeadRepository";
import { RegisterNewUserProfile } from "@/app/api/useCases/profiles/ProfileUseCase";
import { LeadUseCase } from "./LeadUseCase";

/**
 * Raiz de composicao do LeadUseCase.
 *
 * Existe para que as rotas importem apenas o use case ja montado, sem precisar
 * conhecer o repositorio concreto — mesmo padrao de `listTasksUseCase`
 * (ListTasksUseCase.ts) e `pmePlanSimulatorUseCase`.
 */
export const leadUseCase = new LeadUseCase(new LeadRepository(), new RegisterNewUserProfile());
