import { describe, expect, it } from "bun:test"
import type {
  ProviderAdapterView as ContractAdapterView,
  ProviderInstanceView as ContractInstanceView,
} from "@/lib/payment-provider/admin-contract"
import type {
  ProviderAdapterView,
  ProviderInstanceView,
} from "../features/context/BackofficePaymentProvidersTypes"

// A UI espelha o contrato da API; o typecheck falha se os formatos divergirem.
function acceptsInstance(view: ContractInstanceView): ProviderInstanceView {
  return view
}

function acceptsAdapter(view: ContractAdapterView): ProviderAdapterView {
  return view
}

describe("contrato administrativo de providers", () => {
  it("os tipos da UI aceitam o que a API devolve", () => {
    expect(typeof acceptsInstance).toBe("function")
    expect(typeof acceptsAdapter).toBe("function")
  })
})
