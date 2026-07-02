import type { PublicContractShare } from "../context/PublicContractTypes"

export interface IPublicContractService {
  getShare(token: string): Promise<PublicContractShare>
}
