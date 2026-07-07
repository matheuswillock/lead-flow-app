import { Output } from "@/lib/output";
import {
  backofficeOperationalAccessService,
} from "@/app/api/services/backofficeOperationalAccess/BackofficeOperationalAccessService";
import type { IBackofficeOperationalAccessService } from "@/app/api/services/backofficeOperationalAccess/IBackofficeOperationalAccessService";

export class MeOperationalAccessUseCase {
  constructor(
    private readonly service: IBackofficeOperationalAccessService = backofficeOperationalAccessService
  ) {}

  async resolve(profileId: string, teamId: string | null): Promise<Output> {
    try {
      const result = await this.service.resolveOperationalAccess(profileId, teamId);
      return new Output(true, [], [], result);
    } catch (error) {
      console.error("[MeOperationalAccessUseCase][resolve]", error);
      return new Output(false, [], ["Erro ao resolver acessos operacionais"], null);
    }
  }
}

export const meOperationalAccessUseCase = new MeOperationalAccessUseCase();
