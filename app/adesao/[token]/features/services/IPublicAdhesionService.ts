import type {
  PublicAdhesionCheckoutInput,
  PublicAdhesionDetails,
  PublicAdhesionPayment,
  PublicAdhesionPixInput,
} from "../context/PublicAdhesionTypes"

export interface IPublicAdhesionService {
  getDetails(token: string): Promise<PublicAdhesionDetails>
  createCheckout(
    token: string,
    input: PublicAdhesionCheckoutInput
  ): Promise<PublicAdhesionPayment>
  /** PIX cobrado pelo provider de pagamento (Abacate). */
  createPixCheckout(token: string, input: PublicAdhesionPixInput): Promise<PublicAdhesionPayment>
  getPaymentStatus(
    token: string,
    options?: { sync?: boolean }
  ): Promise<PublicAdhesionPayment>
}
