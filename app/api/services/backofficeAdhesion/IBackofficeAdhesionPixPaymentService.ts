import type { BackofficeAdhesionPayment } from "@prisma/client"

export type AdhesionPixPayer = {
  name: string
  email: string
  taxId: string
  cellphone: string
}

export interface CreateAdhesionPixPaymentInput {
  adhesionId: string
  amountCents: number
  payer: AdhesionPixPayer
  idempotencyKey: string
}

export interface IBackofficeAdhesionPixPaymentService {
  createPixPayment(input: CreateAdhesionPixPaymentInput): Promise<BackofficeAdhesionPayment>
  findLatest(adhesionId: string): Promise<BackofficeAdhesionPayment | null>
  /** PIX do provider ainda aguardando pagamento e dentro da validade. */
  hasLivePendingPix(adhesionId: string): Promise<boolean>
  findById(id: string): Promise<BackofficeAdhesionPayment | null>
  /** Invalida os PIX pendentes quando a adesão muda (valor/dados) ou troca de método. */
  supersedePending(adhesionId: string): Promise<number>
  /** Pagamento confirmado que não pode ativar conta sozinho: fica para revisão manual. */
  markNeedsReview(id: string, reason: string): Promise<BackofficeAdhesionPayment | null>
  /** Registra a confirmação do provider; idempotente (linha concluída não regride). */
  markConfirmed(input: {
    id: string
    providerExternalId: string
    confirmedAt: Date
  }): Promise<BackofficeAdhesionPayment | null>
  /** Conclui o pagamento depois do efeito de domínio (conta criada). */
  markCompleted(id: string): Promise<BackofficeAdhesionPayment | null>
}
