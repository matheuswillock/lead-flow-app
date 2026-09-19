import { describe, expect, test } from "bun:test";
import {
  classifyOperatorProvisioning,
  isOperatorProvisioningTerminal,
} from "./operatorProvisioning";

describe("classifyOperatorProvisioning", () => {
  test("operatorCreated vence qualquer status", () => {
    expect(classifyOperatorProvisioning({ paymentStatus: "CONFIRMED", operatorCreated: true })).toBe("created");
    expect(classifyOperatorProvisioning({ paymentStatus: "PENDING", operatorCreated: true })).toBe("created");
  });

  test("PENDING sem operador é espera de pagamento", () => {
    expect(classifyOperatorProvisioning({ paymentStatus: "PENDING", operatorCreated: false })).toBe(
      "awaiting-payment"
    );
  });

  test("CONFIRMED sem operador ainda é provisionamento, não fim", () => {
    expect(classifyOperatorProvisioning({ paymentStatus: "CONFIRMED", operatorCreated: false })).toBe(
      "provisioning"
    );
  });

  test("SUBSCRIPTION_UPDATED é provisionamento — o achado do cursor no PR #1197", () => {
    expect(
      classifyOperatorProvisioning({ paymentStatus: "SUBSCRIPTION_UPDATED", operatorCreated: false })
    ).toBe("provisioning");
  });

  test("falha terminal do Asaas é falha", () => {
    for (const paymentStatus of ["FAILED", "REFUSED", "OVERDUE", "CANCELLED", "REFUNDED"]) {
      expect(classifyOperatorProvisioning({ paymentStatus, operatorCreated: false })).toBe("failed");
    }
  });
});

describe("isOperatorProvisioningTerminal", () => {
  test("NÃO para em SUBSCRIPTION_UPDATED — regressão do achado do cursor", () => {
    expect(
      isOperatorProvisioningTerminal({ paymentStatus: "SUBSCRIPTION_UPDATED", operatorCreated: false })
    ).toBe(false);
  });

  test("NÃO para em CONFIRMED enquanto o operador não existe", () => {
    expect(isOperatorProvisioningTerminal({ paymentStatus: "CONFIRMED", operatorCreated: false })).toBe(
      false
    );
  });

  test("NÃO para em PENDING", () => {
    expect(isOperatorProvisioningTerminal({ paymentStatus: "PENDING", operatorCreated: false })).toBe(
      false
    );
  });

  test("para quando o operador foi criado", () => {
    expect(isOperatorProvisioningTerminal({ paymentStatus: "CONFIRMED", operatorCreated: true })).toBe(
      true
    );
  });

  test("para em falha terminal", () => {
    expect(isOperatorProvisioningTerminal({ paymentStatus: "FAILED", operatorCreated: false })).toBe(true);
  });
});
