import type {
  AddBetaUserPayload,
  BetaClientSearchResult,
  BetaFeatureItem,
  BetaGrantItem,
  BetaGrantTeamItem,
  RawBetaGrant,
  UpdateBetaUserPayload,
} from "../context/BackofficeBetaTypes"

export interface IBackofficeBetaService {
  listBetaFeatures(): Promise<BetaFeatureItem[]>
  listBetaUsers(featureId: string): Promise<BetaGrantItem[]>
  addBetaUser(featureId: string, payload: AddBetaUserPayload): Promise<RawBetaGrant>
  updateBetaUser(featureId: string, payload: UpdateBetaUserPayload): Promise<RawBetaGrant>
  removeBetaUser(featureId: string, profileId: string): Promise<void>
  searchMasters(query: string, page: number): Promise<BetaClientSearchResult>
  getMasterTeams(masterId: string): Promise<BetaGrantTeamItem[]>
}
