import { Output } from "@/lib/output"
import {
  backofficeSponsorAuthorizationService,
} from "@/app/api/services/backofficeSponsorAuthorization/BackofficeSponsorAuthorizationService"
import type { IBackofficeSponsorAuthorizationService } from "@/app/api/services/backofficeSponsorAuthorization/IBackofficeSponsorAuthorizationService"

export interface IBackofficeAuthorizedSponsorUseCase {
  list(grantedByProfileId: string): Promise<Output>
  grant(
    profileId: string,
    grantedByProfileId: string,
    notes?: string | null
  ): Promise<Output>
  revoke(profileId: string, revokedByProfileId: string): Promise<Output>
}

export class BackofficeAuthorizedSponsorUseCase implements IBackofficeAuthorizedSponsorUseCase {
  constructor(
    private readonly sponsorAuthorization: IBackofficeSponsorAuthorizationService = backofficeSponsorAuthorizationService
  ) {}

  async list(_grantedByProfileId: string): Promise<Output> {
    try {
      const [items, eligibleMasters] = await Promise.all([
        this.sponsorAuthorization.listAllWithCounts(),
        this.sponsorAuthorization.listEligibleMasters(),
      ])
      return new Output(true, ["Patrocinadores listados"], [], { items, eligibleMasters })
    } catch (error) {
      console.error("[BackofficeAuthorizedSponsorUseCase][list]", error)
      return new Output(false, [], ["Erro ao listar patrocinadores autorizados"], null)
    }
  }

  async grant(
    profileId: string,
    grantedByProfileId: string,
    notes?: string | null
  ): Promise<Output> {
    try {
      const result = await this.sponsorAuthorization.grant(profileId, grantedByProfileId, notes)
      if ("error" in result) {
        return new Output(false, [], [result.error], null)
      }
      return new Output(true, ["Patrocinador autorizado com sucesso"], [], result.record)
    } catch (error) {
      console.error("[BackofficeAuthorizedSponsorUseCase][grant]", error)
      return new Output(false, [], ["Erro ao autorizar patrocinador"], null)
    }
  }

  async revoke(profileId: string, revokedByProfileId: string): Promise<Output> {
    try {
      const result = await this.sponsorAuthorization.revoke(profileId, revokedByProfileId)
      if ("error" in result) {
        return new Output(false, [], [result.error], null)
      }
      return new Output(true, ["Autorização revogada com sucesso"], [], result.record)
    } catch (error) {
      console.error("[BackofficeAuthorizedSponsorUseCase][revoke]", error)
      return new Output(false, [], ["Erro ao revogar patrocinador"], null)
    }
  }
}

export const backofficeAuthorizedSponsorUseCase = new BackofficeAuthorizedSponsorUseCase()
