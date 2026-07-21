import { Output } from "@/lib/output";
import {
  backofficeOperationalAccessService,
} from "@/app/api/services/backofficeOperationalAccess/BackofficeOperationalAccessService";
import type { IBackofficeOperationalAccessService } from "@/app/api/services/backofficeOperationalAccess/IBackofficeOperationalAccessService";

export interface IBackofficeOperationalAccessUseCase {
  list(): Promise<Output>;
  grantAssociados(profileId: string, grantedByProfileId: string, notes?: string | null): Promise<Output>;
  grantMultiskillOrigin(masterId: string, grantedByProfileId: string, notes?: string | null): Promise<Output>;
  revoke(grantId: string, revokedByProfileId: string): Promise<Output>;
}

export class BackofficeOperationalAccessUseCase implements IBackofficeOperationalAccessUseCase {
  constructor(
    private readonly service: IBackofficeOperationalAccessService = backofficeOperationalAccessService
  ) {}

  async list(): Promise<Output> {
    try {
      const result = await this.service.listForBackoffice();
      return new Output(true, [], [], result);
    } catch (error) {
      console.error("[BackofficeOperationalAccessUseCase][list]", error);
      return new Output(false, [], ["Erro ao listar acessos operacionais"], null);
    }
  }

  async grantAssociados(
    profileId: string,
    grantedByProfileId: string,
    notes?: string | null
  ): Promise<Output> {
    try {
      const result = await this.service.grantAssociadosQueue({
        profileId,
        grantedByProfileId,
        notes,
      });
      if ("error" in result) {
        return new Output(false, [], [result.error], null);
      }
      return new Output(true, ["Acesso à fila Associados concedido"], [], result);
    } catch (error) {
      console.error("[BackofficeOperationalAccessUseCase][grantAssociados]", error);
      return new Output(false, [], ["Erro ao conceder acesso Associados"], null);
    }
  }

  async grantMultiskillOrigin(
    masterId: string,
    grantedByProfileId: string,
    notes?: string | null
  ): Promise<Output> {
    try {
      const result = await this.service.grantMultiskillOriginByMaster({
        masterId,
        grantedByProfileId,
        notes,
      });
      if ("error" in result) {
        return new Output(false, [], [result.error], null);
      }
      return new Output(true, ["Conta MultiSkill autorizada com sucesso"], [], result);
    } catch (error) {
      console.error("[BackofficeOperationalAccessUseCase][grantMultiskillOrigin]", error);
      return new Output(false, [], ["Erro ao autorizar conta MultiSkill"], null);
    }
  }

  async revoke(grantId: string, revokedByProfileId: string): Promise<Output> {
    try {
      const result = await this.service.revoke(grantId, revokedByProfileId);
      if ("error" in result) {
        return new Output(false, [], [result.error], null);
      }
      return new Output(true, ["Autorização revogada com sucesso"], [], result);
    } catch (error) {
      console.error("[BackofficeOperationalAccessUseCase][revoke]", error);
      return new Output(false, [], ["Erro ao revogar autorização"], null);
    }
  }
}

export const backofficeOperationalAccessUseCase = new BackofficeOperationalAccessUseCase();
