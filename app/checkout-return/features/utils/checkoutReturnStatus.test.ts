import { describe, expect, test } from "bun:test";
import {
  isPaidPaymentStatus,
  readPaymentReference,
  resolveCheckoutReturnStatusFromPayment,
  resolveInitialCheckoutReturnStatus,
} from "./checkoutReturnStatus";

describe("isPaidPaymentStatus", () => {
  test("nulo/indefinido nunca é pago", () => {
    expect(isPaidPaymentStatus(null)).toBe(false);
    expect(isPaidPaymentStatus(undefined)).toBe(false);
  });

  test("PENDING/OVERDUE/REFUSED não são pagos", () => {
    expect(isPaidPaymentStatus("PENDING")).toBe(false);
    expect(isPaidPaymentStatus("OVERDUE")).toBe(false);
    expect(isPaidPaymentStatus("REFUSED")).toBe(false);
  });

  test("RECEIVED/CONFIRMED/RECEIVED_IN_CASH/APPROVED são pagos", () => {
    expect(isPaidPaymentStatus("RECEIVED")).toBe(true);
    expect(isPaidPaymentStatus("CONFIRMED")).toBe(true);
    expect(isPaidPaymentStatus("RECEIVED_IN_CASH")).toBe(true);
    expect(isPaidPaymentStatus("APPROVED")).toBe(true);
  });
});

describe("readPaymentReference", () => {
  test("prefere 'payment'", () => {
    const params = new URLSearchParams({ payment: "pay_1", paymentId: "pay_2" });
    expect(readPaymentReference(params)).toBe("pay_1");
  });

  test("cai para 'paymentId' quando 'payment' está ausente", () => {
    const params = new URLSearchParams({ paymentId: "pay_2" });
    expect(readPaymentReference(params)).toBe("pay_2");
  });

  test("cai para 'checkoutId' quando os dois anteriores estão ausentes", () => {
    const params = new URLSearchParams({ checkoutId: "chk_3" });
    expect(readPaymentReference(params)).toBe("chk_3");
  });

  test("nenhuma referência disponível → null (caso real hoje)", () => {
    const params = new URLSearchParams();
    expect(readPaymentReference(params)).toBeNull();
  });
});

describe("resolveInitialCheckoutReturnStatus", () => {
  test("sem referência: cai direto no honesto 'processing' — nunca 'confirmed'", () => {
    expect(resolveInitialCheckoutReturnStatus(null)).toBe("processing");
  });

  test("com referência: começa 'checking' — nunca 'confirmed' sem verificação (P1-3)", () => {
    expect(resolveInitialCheckoutReturnStatus("pay_1")).toBe("checking");
  });
});

describe("resolveCheckoutReturnStatusFromPayment (achado P2 do Codex no PR #1197)", () => {
  test("pago vira 'confirmed'", () => {
    expect(resolveCheckoutReturnStatusFromPayment("CONFIRMED")).toBe("confirmed");
    expect(resolveCheckoutReturnStatusFromPayment("RECEIVED")).toBe("confirmed");
  });

  test("falha terminal vira 'failed' — nunca roda até o teto para dizer 'avisaremos por e-mail'", () => {
    for (const status of ["REFUSED", "REFUNDED", "CHARGEBACK_REQUESTED", "OVERDUE", "CANCELLED"]) {
      expect(resolveCheckoutReturnStatusFromPayment(status)).toBe("failed");
    }
  });

  test("em trânsito devolve null: segue verificando", () => {
    expect(resolveCheckoutReturnStatusFromPayment("PENDING")).toBeNull();
    expect(resolveCheckoutReturnStatusFromPayment("BANK_PROCESSING")).toBeNull();
    expect(resolveCheckoutReturnStatusFromPayment(null)).toBeNull();
  });
});
