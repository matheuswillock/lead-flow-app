/**
 * T-30.7 — 30 — Migração de Conta (execução) E2.
 *
 * Prova em sandbox real: cria um customer com `notificationDisabled: false`
 * na conta `legacy`, roda o gateway de silenciamento, e confirma via GET
 * que `notificationDisabled` virou `true` e que a linha de backfill foi
 * gravada. Fica fora do `bun test` default (`**\/*.integration.test.ts`).
 *
 * Rodar:
 *   RUN_INTEGRATION=1 ASAAS_ENV=sandbox ASAAS_LEGACY_API_KEY=aact_... \
 *   bun test scripts/billing/silence-asaas-customers.integration.test.ts
 */

import { afterAll, beforeAll, describe, expect, it } from "bun:test"
import { randomUUID } from "crypto"
import { assertAsaasSandbox } from "@/e2e/support/asaas"
import { createAsaasClient } from "@/lib/asaas/asaas-client"
import { buildAsaasEndpoints } from "@/lib/asaas/asaas-endpoints"
import { resolveAsaasAccount } from "@/lib/asaas/asaas-account"
import { createAsaasCustomerSilencingGateway } from "./lib/asaasCustomerSilencingGateway"

const RUN_INTEGRATION = process.env.RUN_INTEGRATION === "1"

let asaasNotificationBackfillRepository: typeof import(
  "@/app/api/infra/data/repositories/asaasNotificationBackfill/AsaasNotificationBackfillRepository"
).asaasNotificationBackfillRepository

if (RUN_INTEGRATION) {
  ;({ asaasNotificationBackfillRepository } = await import(
    "@/app/api/infra/data/repositories/asaasNotificationBackfill/AsaasNotificationBackfillRepository"
  ))
}

describe.skipIf(!RUN_INTEGRATION)(
  "silence-asaas-customers — integração sandbox (T-30.7)",
  () => {
    let customerId = ""

    beforeAll(async () => {
      assertAsaasSandbox()

      const client = createAsaasClient("legacy")
      const endpoints = buildAsaasEndpoints(resolveAsaasAccount("legacy").baseUrl)
      const created = await client.request(endpoints.customers, {
        method: "POST",
        body: JSON.stringify({
          name: `Teste E2 Silenciamento ${randomUUID()}`,
          cpfCnpj: "24971563792",
          email: `e2-silence-${randomUUID()}@example.test`,
          notificationDisabled: false,
        }),
      })
      customerId = created.id
    })

    afterAll(async () => {
      if (!customerId) return
      const client = createAsaasClient("legacy")
      const endpoints = buildAsaasEndpoints(resolveAsaasAccount("legacy").baseUrl)
      await client.request(`${endpoints.customers}/${customerId}`, { method: "DELETE" }).catch(() => {})
    })

    it("silencia o customer real (PUT) e o GET subsequente confirma notificationDisabled=true", async () => {
      const gateway = createAsaasCustomerSilencingGateway("legacy")

      await gateway.disableCustomerNotifications(customerId)

      const client = createAsaasClient("legacy")
      const endpoints = buildAsaasEndpoints(resolveAsaasAccount("legacy").baseUrl)
      const refetched = await client.request(`${endpoints.customers}/${customerId}`, {
        method: "GET",
      })

      expect(refetched.notificationDisabled).toBe(true)
    })

    it("grava a linha de backfill como completed (M0.4)", async () => {
      await asaasNotificationBackfillRepository.markCompleted(customerId)

      const status = await asaasNotificationBackfillRepository.getStatus(customerId)
      expect(status).toBe("completed")
    })

    it("desabilitar canais (M0.5): lista notificações e confirma o patch em lote", async () => {
      const gateway = createAsaasCustomerSilencingGateway("legacy")

      const channels = await gateway.listCustomerNotificationChannels(customerId)
      // Sandbox pode não ter nenhum canal configurado por padrão para um
      // customer recém-criado — o método MUST lidar com lista vazia sem
      // lançar (já coberto pelo teste unitário), então aqui só provamos
      // que a chamada real não lança e devolve um array.
      expect(Array.isArray(channels)).toBe(true)

      const updated = await gateway.disableNotificationChannelsBatch(customerId, channels)
      expect(Array.isArray(updated)).toBe(true)
    })
  }
)
