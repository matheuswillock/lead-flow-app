import type { IBackofficeSponsorAuthorizationRepository } from "@/app/api/infra/data/repositories/backofficeSponsorAuthorization/IBackofficeSponsorAuthorizationRepository"
import { BackofficeSponsorAuthorizationRepository } from "@/app/api/infra/data/repositories/backofficeSponsorAuthorization/BackofficeSponsorAuthorizationRepository"
import type {
  AuthorizedSponsorListItem,
  AuthorizedSponsorOption,
  IBackofficeSponsorAuthorizationService,
  SponsorAuthorizationResult,
} from "./IBackofficeSponsorAuthorizationService"

const UNAUTHORIZED_MESSAGE = "Patrocinador não autorizado"

export class BackofficeSponsorAuthorizationService implements IBackofficeSponsorAuthorizationService {
  constructor(
    private readonly repository: IBackofficeSponsorAuthorizationRepository = new BackofficeSponsorAuthorizationRepository()
  ) {}

  async assertAuthorizedSponsor(sponsorProfileId: string): Promise<SponsorAuthorizationResult> {
    const profile = await this.repository.findProfileById(sponsorProfileId)
    if (!profile) {
      return {
        isAuthorized: false,
        reason: "not_found",
        errorMessage: "Patrocinador inválido",
      }
    }

    if (!profile.isMaster) {
      return {
        isAuthorized: false,
        reason: "not_master",
        errorMessage: UNAUTHORIZED_MESSAGE,
      }
    }

    const authorization = await this.repository.findActiveAuthorization(sponsorProfileId)
    if (!authorization?.isActive) {
      return {
        isAuthorized: false,
        reason: "not_authorized",
        errorMessage: UNAUTHORIZED_MESSAGE,
      }
    }

    return { isAuthorized: true, errorMessage: null }
  }

  async listAuthorizedSponsors(): Promise<AuthorizedSponsorOption[]> {
    return this.repository.listActiveAuthorizedProfiles()
  }

  async listAllWithCounts(): Promise<AuthorizedSponsorListItem[]> {
    const records = await this.repository.listAllWithAudit()
    const counts = await Promise.all(
      records.map((record) => this.repository.countSponsoredAccounts(record.profileId))
    )

    return records.map((record, index) => ({
      id: record.profile.id,
      fullName: record.profile.fullName,
      email: record.profile.email,
      isActive: record.isActive,
      grantedAt: record.grantedAt,
      grantedBy: record.grantedBy,
      revokedAt: record.revokedAt,
      revokedBy: record.revokedBy,
      notes: record.notes,
      sponsoredAccountsCount: counts[index] ?? 0,
    }))
  }

  async grant(
    profileId: string,
    grantedByProfileId: string,
    notes?: string | null
  ): Promise<{ record: AuthorizedSponsorListItem } | { error: string }> {
    const profile = await this.repository.findProfileById(profileId)
    if (!profile) {
      return { error: "Usuário não encontrado" }
    }
    if (!profile.isMaster) {
      return { error: "Somente masters podem ser autorizados como patrocinadores" }
    }

    const record = await this.repository.grant({
      profileId,
      grantedByProfileId,
      notes,
    })
    const sponsoredAccountsCount = await this.repository.countSponsoredAccounts(profileId)

    return {
      record: {
        id: record.profile.id,
        fullName: record.profile.fullName,
        email: record.profile.email,
        isActive: record.isActive,
        grantedAt: record.grantedAt,
        grantedBy: record.grantedBy,
        revokedAt: record.revokedAt,
        revokedBy: record.revokedBy,
        notes: record.notes,
        sponsoredAccountsCount,
      },
    }
  }

  async revoke(
    profileId: string,
    revokedByProfileId: string
  ): Promise<{ record: AuthorizedSponsorListItem } | { error: string }> {
    const record = await this.repository.revoke({ profileId, revokedByProfileId })
    if (!record) {
      return { error: "Patrocinador autorizado não encontrado" }
    }

    const sponsoredAccountsCount = await this.repository.countSponsoredAccounts(profileId)

    return {
      record: {
        id: record.profile.id,
        fullName: record.profile.fullName,
        email: record.profile.email,
        isActive: record.isActive,
        grantedAt: record.grantedAt,
        grantedBy: record.grantedBy,
        revokedAt: record.revokedAt,
        revokedBy: record.revokedBy,
        notes: record.notes,
        sponsoredAccountsCount,
      },
    }
  }

  countSponsoredAccounts(profileId: string): Promise<number> {
    return this.repository.countSponsoredAccounts(profileId)
  }

  async listEligibleMasters(): Promise<AuthorizedSponsorOption[]> {
    return this.repository.listEligibleMasterProfiles()
  }
}

export const backofficeSponsorAuthorizationService = new BackofficeSponsorAuthorizationService()
