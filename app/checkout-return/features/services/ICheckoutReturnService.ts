export interface PaymentStatusLookup {
  status: string | null;
}

export interface ICheckoutReturnService {
  getPaymentStatus(paymentReference: string): Promise<PaymentStatusLookup>;
}
