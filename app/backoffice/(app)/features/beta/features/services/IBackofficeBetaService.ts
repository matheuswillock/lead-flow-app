import type { BetaClientSearchResult, BetaFeatureItem, BetaGrantItem, RawBetaGrant } from "../context/BackofficeBetaTypes"

export interface IBackofficeBetaService {
  listBetaFeatures(): Promise<BetaFeatureItem[]>
  listBetaUsers(featureId: string): Promise<BetaGrantItem[]>
  addBetaUser(featureId: string, profileId: string): Promise<RawBetaGrant>
  removeBetaUser(featureId: string, profileId: string): Promise<void>
  searchClients(query: string, page: number): Promise<BetaClientSearchResult>
}
