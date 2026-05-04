import type {
  PublicAdhesionCheckoutInput,
  PublicAdhesionDetails,
  PublicAdhesionPayment,
} from "../context/PublicAdhesionTypes"

export interface IPublicAdhesionService {
  getDetails(token: string): Promise<PublicAdhesionDetails>
  createCheckout(
    token: string,
    input: PublicAdhesionCheckoutInput
  ): Promise<PublicAdhesionPayment>
  getPaymentStatus(
    token: string,
    options?: { sync?: boolean }
  ): Promise<PublicAdhesionPayment>
}
