import type { ICheckoutReturnService } from "./ICheckoutReturnService"

export class CheckoutReturnService implements ICheckoutReturnService {
  getRedirectUrl(): string {
    return "/sign-in"
  }
}
