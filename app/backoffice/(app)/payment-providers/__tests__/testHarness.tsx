import type { ReactNode } from "react"
import { BackofficeUserProvider } from "@/app/backoffice/context/BackofficeUserContext"
import { BackofficePaymentProvidersProvider } from "../features/context/BackofficePaymentProvidersContext"
import type {
  CreateProviderInstanceInput,
  PaymentProviderEnvironment,
  ProviderAdapterView,
  ProviderHistoryItem,
  ProviderInstanceView,
  UpdateProviderInstanceInput,
} from "../features/context/BackofficePaymentProvidersTypes"
import type { IBackofficePaymentProvidersService } from "../features/services/IBackofficePaymentProvidersService"

/** Valor sentinela: nunca pode aparecer no DOM depois de salvo. */
export const SECRET_SENTINEL = "sk_live_SENTINEL_NEVER_RENDER_9f3a"

export function installBrowserStubs() {
  if (!globalThis.ResizeObserver) {
    globalThis.ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    } as unknown as typeof ResizeObserver
  }
  if (!window.matchMedia) {
    window.matchMedia = ((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    })) as unknown as typeof window.matchMedia
  }
  const element = window.HTMLElement.prototype as unknown as Record<string, unknown>
  if (!element.scrollIntoView) element.scrollIntoView = () => {}
  if (!element.hasPointerCapture) element.hasPointerCapture = () => false
  if (!element.setPointerCapture) element.setPointerCapture = () => {}
  if (!element.releasePointerCapture) element.releasePointerCapture = () => {}
}

export function stubCurrentUser(isOperator: boolean) {
  const original = globalThis.fetch
  globalThis.fetch = (async () =>
    new Response(
      JSON.stringify({ isValid: true, errorMessages: [], successMessages: [], result: { isOperator, fullAccess: !isOperator } }),
      { status: 200 }
    )) as unknown as typeof fetch
  return () => {
    globalThis.fetch = original
  }
}

export function makeInstance(overrides: Partial<ProviderInstanceView> = {}): ProviderInstanceView {
  return {
    id: "cfg-1",
    providerKey: "ABACATE_PAY",
    environment: "PRODUCTION",
    externalAccountContext: "default",
    displayName: "Abacate Pay principal",
    logoUrl: null,
    logoAltText: null,
    enabled: true,
    isDefault: true,
    rolloutState: "ACTIVE",
    killSwitch: false,
    configRevision: 3,
    healthStatus: "HEALTHY",
    lastHealthCheckAt: "2026-10-21T10:00:00.000Z",
    lastErrorCode: null,
    paymentCapable: true,
    credentials: [
      { key: "API_KEY", isSet: true, last4: "ab12", fingerprint: "fp_1a2b", required: true, updatedAt: "2026-10-20T10:00:00.000Z" },
      { key: "WEBHOOK_SECRET", isSet: false, last4: null, fingerprint: null, required: true, updatedAt: null },
    ],
    settings: { requireSignature: true, cardEnabled: false },
    ...overrides,
  }
}

export const ALL_CREDENTIALS_SET: ProviderInstanceView["credentials"] = [
  { key: "API_KEY", isSet: true, last4: "ab12", fingerprint: "fp_1a2b", required: true, updatedAt: null },
  { key: "WEBHOOK_SECRET", isSet: true, last4: "cd34", fingerprint: "fp_3c4d", required: true, updatedAt: null },
]

export const ADAPTERS: ProviderAdapterView[] = [
  {
    providerKey: "ABACATE_PAY",
    label: "Abacate Pay",
    paymentCapable: true,
    credentialSchema: [
      { key: "API_KEY", label: "Chave de API", required: true, secret: true, hint: "" },
      { key: "WEBHOOK_SECRET", label: "Segredo do webhook", required: true, secret: true, hint: "Usado na assinatura HMAC." },
    ],
  },
  {
    providerKey: "ASAAS",
    label: "Asaas",
    paymentCapable: false,
    credentialSchema: [{ key: "API_KEY", label: "Chave de API", required: true, secret: true, hint: "" }],
  },
]

export class FakePaymentProvidersService implements IBackofficePaymentProvidersService {
  calls: { method: string; args: unknown[] }[] = []
  failNextUpdateWith: Error | null = null
  failNextCredentialWith: Error | null = null

  constructor(public instances: ProviderInstanceView[]) {}

  private record(method: string, ...args: unknown[]) {
    this.calls.push({ method, args })
  }

  async listInstances(environment: PaymentProviderEnvironment) {
    this.record("listInstances", environment)
    return this.instances.filter((i) => i.environment === environment)
  }
  async listAdapters() {
    this.record("listAdapters")
    return ADAPTERS
  }
  async createInstance(input: CreateProviderInstanceInput) {
    this.record("createInstance", input)
    const created = makeInstance({
      id: "cfg-new",
      providerKey: input.providerKey,
      environment: input.environment,
      externalAccountContext: input.externalAccountContext,
      displayName: input.displayName,
      isDefault: false,
      credentials: [],
    })
    this.instances = [...this.instances, created]
    return created
  }
  async updateInstance(input: UpdateProviderInstanceInput) {
    this.record("updateInstance", input)
    if (this.failNextUpdateWith) {
      const error = this.failNextUpdateWith
      this.failNextUpdateWith = null
      throw error
    }
    const current = this.instances.find((i) => i.id === input.id)!
    const { id: _id, expectedRevision: _rev, settings, ...patch } = input
    const updated = {
      ...current,
      ...patch,
      settings: { ...current.settings, ...settings },
      configRevision: current.configRevision + 1,
    } as ProviderInstanceView
    this.instances = this.instances.map((i) => (i.id === updated.id ? updated : i))
    return updated
  }
  async setCredential(configId: string, key: string, value: string) {
    this.record("setCredential", configId, key, value)
    if (this.failNextCredentialWith) {
      const error = this.failNextCredentialWith
      this.failNextCredentialWith = null
      throw error
    }
    const current = this.instances.find((i) => i.id === configId)!
    const updated: ProviderInstanceView = {
      ...current,
      credentials: current.credentials.map((c) =>
        c.key === key ? { ...c, isSet: true, last4: value.slice(-4), fingerprint: "fp_new" } : c
      ),
    }
    this.instances = this.instances.map((i) => (i.id === configId ? updated : i))
    return updated
  }
  async removeCredential(configId: string, key: string) {
    this.record("removeCredential", configId, key)
    const current = this.instances.find((i) => i.id === configId)!
    return {
      ...current,
      credentials: current.credentials.map((c) => (c.key === key ? { ...c, isSet: false, last4: null, fingerprint: null } : c)),
    }
  }
  async runHealthCheck(id: string) {
    this.record("runHealthCheck", id)
    return this.instances.find((i) => i.id === id)!
  }
  async listHistory(configId: string): Promise<ProviderHistoryItem[]> {
    this.record("listHistory", configId)
    return [{ at: "2026-10-21T09:00:00.000Z", actor: "ana@exemplo.com", operation: "credential.set", summary: "Credencial API_KEY definida" }]
  }
}

export function renderWithProviders(service: IBackofficePaymentProvidersService, children: ReactNode) {
  return (
    <BackofficeUserProvider>
      <BackofficePaymentProvidersProvider service={service}>{children}</BackofficePaymentProvidersProvider>
    </BackofficeUserProvider>
  )
}
