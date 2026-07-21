import type { PublicOfferShare } from "../context/PublicOfferTypes"

export interface IPublicOfferService {
  getShare(token: string): Promise<PublicOfferShare>
}
