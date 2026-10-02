import { describe, expect, test } from "bun:test";
import {
  SUBSCRIPTION_UPDATED_MARKER,
  classifyPaymentStatus,
  isPaidPaymentStatus,
  isTerminalFailurePaymentStatus,
  isTerminalPaymentStatus,
} from "./payment-status-vocabulary";

describe("isPaidPaymentStatus", () => {
  test("nulo/indefinido nunca é pago", () => {
    expect(isPaidPaymentStatus(null)).toBe(false);
    expect(isPaidPaymentStatus(undefined)).toBe(false);
  });

  test("RECEIVED/CONFIRMED/RECEIVED_IN_CASH/APPROVED são pagos", () => {
    for (const status of ["RECEIVED", "CONFIRMED", "RECEIVED_IN_CASH", "APPROVED"]) {
      expect(isPaidPaymentStatus(status)).toBe(true);
    }
  });

  test("falha terminal e em-trânsito não são pagos", () => {
    for (const status of ["REFUSED", "OVERDUE", "PENDING", SUBSCRIPTION_UPDATED_MARKER]) {
      expect(isPaidPaymentStatus(status)).toBe(false);
    }
  });
});

describe("isTerminalFailurePaymentStatus (achado Codex P2 no PR #1197)", () => {
  test("REFUSED/REFUNDED/CHARGEBACK/OVERDUE/CANCELLED são falha terminal", () => {
    for (const status of [
      "REFUSED",
      "REFUNDED",
      "REFUND_REQUESTED",
      "CHARGEBACK_REQUESTED",
      "CHARGEBACK_DISPUTE",
      "AWAITING_CHARGEBACK_REVERSAL",
      "CANCELLED",
      "CANCELED",
      "OVERDUE",
      "FAILED",
    ]) {
      expect(isTerminalFailurePaymentStatus(status)).toBe(true);
    }
  });

  test("pago não é falha", () => {
    expect(isTerminalFailurePaymentStatus("CONFIRMED")).toBe(false);
  });

  test("em trânsito não é falha", () => {
    expect(isTerminalFailurePaymentStatus("PENDING")).toBe(false);
    expect(isTerminalFailurePaymentStatus("BANK_PROCESSING")).toBe(false);
  });
});

describe("classifyPaymentStatus", () => {
  test("PENDING e BANK_PROCESSING seguem em trânsito", () => {
    expect(classifyPaymentStatus("PENDING")).toBe("in-flight");
    expect(classifyPaymentStatus("BANK_PROCESSING")).toBe("in-flight");
  });

  test("SUBSCRIPTION_UPDATED é marcador de provisionamento, nunca terminal (achado cursor no PR #1197)", () => {
    expect(classifyPaymentStatus(SUBSCRIPTION_UPDATED_MARKER)).toBe("in-flight");
    expect(isTerminalPaymentStatus(SUBSCRIPTION_UPDATED_MARKER)).toBe(false);
  });

  test("status desconhecido/novo do Asaas segue em trânsito, nunca vira falha inventada", () => {
    expect(classifyPaymentStatus("ALGUM_STATUS_NOVO")).toBe("in-flight");
  });

  test("nulo segue em trânsito", () => {
    expect(classifyPaymentStatus(null)).toBe("in-flight");
  });
});

describe("isTerminalPaymentStatus", () => {
  test("para em pago e em falha terminal", () => {
    expect(isTerminalPaymentStatus("CONFIRMED")).toBe(true);
    expect(isTerminalPaymentStatus("REFUSED")).toBe(true);
  });

  test("não para em PENDING", () => {
    expect(isTerminalPaymentStatus("PENDING")).toBe(false);
  });
});
