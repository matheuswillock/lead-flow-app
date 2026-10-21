import type {
  CreateProviderInstanceInput,
  PaymentProviderEnvironment,
  ProviderAdapterView,
  ProviderHistoryItem,
  ProviderInstanceView,
  UpdateProviderInstanceInput,
} from "../context/BackofficePaymentProvidersTypes"

export interface IBackofficePaymentProvidersService {
  listInstances(environment: PaymentProviderEnvironment): Promise<ProviderInstanceView[]>
  listAdapters(): Promise<ProviderAdapterView[]>
  createInstance(input: CreateProviderInstanceInput): Promise<ProviderInstanceView>
  updateInstance(input: UpdateProviderInstanceInput): Promise<ProviderInstanceView>
  /** O valor só trafega nesta chamada de escrita; nunca é lido de volta. */
  setCredential(configId: string, key: string, value: string): Promise<ProviderInstanceView>
  removeCredential(configId: string, key: string): Promise<ProviderInstanceView>
  runHealthCheck(id: string): Promise<ProviderInstanceView>
  listHistory(configId: string): Promise<ProviderHistoryItem[]>
}
