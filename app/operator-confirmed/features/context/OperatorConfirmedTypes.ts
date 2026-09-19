export interface PendingOperatorData {
  id: string;
  name: string;
  email: string;
  paymentId: string;
  paymentStatus: string;
  operatorCreated: boolean;
  managerId: string;
}

export type OperatorConfirmedStep = "loading" | "error" | "ready";

export interface OperatorConfirmedState {
  step: OperatorConfirmedStep;
  operatorData: PendingOperatorData | null;
  error: string | null;
  /** Teto de polling atingido sem confirmação — nunca spinner eterno (DA3). */
  pollCapped: boolean;
}

export const initialOperatorConfirmedState: OperatorConfirmedState = {
  step: "loading",
  operatorData: null,
  error: null,
  pollCapped: false,
};
