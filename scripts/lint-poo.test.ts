import { describe, expect, test } from "bun:test";

import { evaluateLegacyExceptions, scanSource } from "./lint-poo";

describe("lint-poo", () => {
  test("aceita uma classe de provider com contrato e estado encapsulado", () => {
    const findings = scanSource(
      "app/api/infra/paymentProviders/AcmePaymentProvider.ts",
      `interface PaymentProvider { charge(): Promise<void> }
       class AcmePaymentProvider implements PaymentProvider {
         private readonly client = createClient()
         async charge() {}
       }`,
    );
    expect(findings).toEqual([]);
  });

  test("aceita interfaces divididas por capacidades", () => {
    const findings = scanSource(
      "app/api/infra/paymentProviders/PaymentReader.ts",
      `interface PaymentReader { find(): Promise<void> }
       interface PaymentCanceller { cancel(): Promise<void> }`,
    );
    expect(findings).toEqual([]);
  });

  test("detecta SDK em UseCase e instanciação concreta", () => {
    const findings = scanSource(
      "app/api/useCases/payments/ChargeUseCase.ts",
      `import { createAsaasClient } from "@/lib/asaas"
       class ChargeUseCase { execute() { const provider = new AsaasPaymentProvider() } }`,
    );
    expect(findings.map((finding) => finding.code)).toEqual(expect.arrayContaining(["POO001", "POO002", "POO008"]));
  });

  test("detecta payload externo atravessando a fronteira", () => {
    const findings = scanSource(
      "app/api/services/payment/PaymentService.ts",
      `import type { AsaasPaymentResponse } from "asaas-sdk/types"`,
    );
    expect(findings.some((finding) => finding.code === "POO004")).toBe(true);
  });

  test("detecta estado público mutável e classe-base específica", () => {
    const findings = scanSource(
      "app/api/infra/paymentProviders/BaseAsaasProvider.ts",
      `abstract class BaseAsaasProvider {
         public client = createAsaasClient()
       }`,
    );
    expect(findings.map((finding) => finding.code)).toContain("POO005");
    expect(findings.map((finding) => finding.code)).toContain("POO006");
  });

  test("detecta provider sem contrato e interface gigante", () => {
    const members = Array.from({ length: 13 }, (_, index) => `method${index}(): void`).join("\n");
    const findings = scanSource(
      "app/api/infra/paymentProviders/LegacyPaymentProvider.ts",
      `interface ILegacyContract { ${members} }
       class LegacyPaymentProvider { public state = 1 }`,
    );
    expect(findings.map((finding) => finding.code)).toEqual(expect.arrayContaining(["POO003", "POO005", "POO007"]));
  });

  test("tolera legado inalterado", () => {
    const findings = scanSource(
      "app/api/services/LegacyPaymentService.ts",
      `import { createAsaasClient } from "@/lib/asaas"`,
    );
    const result = evaluateLegacyExceptions(
      findings,
      ["app/api/services/LegacyPaymentService.ts"],
      new Set(),
    );
    expect(result.errors).toEqual([]);
    expect(result.warnings[0]).toContain("inalterado");
  });

  test("rejeita legado alterado até corrigir todas as violações", () => {
    const findings = scanSource(
      "app/api/services/LegacyPaymentService.ts",
      `import { createAsaasClient } from "@/lib/asaas"`,
    );
    const result = evaluateLegacyExceptions(
      findings,
      ["app/api/services/LegacyPaymentService.ts"],
      new Set(["app/api/services/LegacyPaymentService.ts"]),
    );
    expect(result.errors[0]).toContain("perdeu a tolerância");
  });

  test("aceita legado alterado quando corrigido e avisa allowlist obsoleta", () => {
    const result = evaluateLegacyExceptions(
      [],
      ["app/api/services/LegacyPaymentService.ts"],
      new Set(["app/api/services/LegacyPaymentService.ts"]),
    );
    expect(result.errors).toEqual([]);
    expect(result.warnings[0]).toContain("pode ser removida");
  });

  test("rejeita uma entrada de allowlist inexistente", () => {
    const result = evaluateLegacyExceptions([], ["app/nao-existe.ts"], new Set(), ["app/nao-existe.ts"]);
    expect(result.errors[0]).toContain("arquivo inexistente");
  });

  test("ordena a saída de forma determinística e usa mensagens em português", () => {
    const findings = scanSource(
      "app/api/useCases/payments/ChargeUseCase.ts",
      `import { createAsaasClient } from "@/lib/asaas"`,
    );
    const result = evaluateLegacyExceptions(findings, [], new Set());
    expect(result.errors[0]).toMatch(/^POO001 app\/api\/useCases\/payments\/ChargeUseCase\.ts:1/);
    expect(result.errors[0]).toContain("Recomenda-se");
  });
});
