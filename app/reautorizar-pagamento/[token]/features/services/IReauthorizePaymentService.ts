export interface IReauthorizePaymentService {
  getContext(token: string): Promise<unknown>
  submit(token: string, payload: unknown): Promise<unknown>
}
