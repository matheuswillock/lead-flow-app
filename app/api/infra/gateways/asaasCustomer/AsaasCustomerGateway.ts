import { asaasApi, asaasFetch, createAsaasClient } from "@/lib/asaas"
import type {
  CreateAsaasCustomerInput,
  CreatedAsaasCustomer,
  IAsaasCustomerGateway,
} from "./IAsaasCustomerGateway"

function resolveExternalReference(input: CreateAsaasCustomerInput): string {
  if (input.profileId) return input.profileId
  if (input.adhesionId) return `backoffice-adhesion-${input.adhesionId}`
  throw new Error(
    "AsaasCustomerGateway.createCustomer requer profileId ou adhesionId (âncora de reconciliação)"
  )
}

export class AsaasCustomerGateway implements IAsaasCustomerGateway {
  async findCustomerByExternalReference(externalReference: string): Promise<CreatedAsaasCustomer | null> {
    const client = createAsaasClient("primary")
    const response = await client.request(
      `${client.endpoints.customers}?externalReference=${encodeURIComponent(externalReference)}`,
      { method: "GET" },
    )
    const records = Array.isArray(response?.data) ? response.data : []
    if (records.length > 1) throw new Error(`Asaas retornou múltiplos customers para externalReference=${externalReference}`)
    const id = records[0]?.id
    return typeof id === "string" && id.length > 0 ? { id } : null
  }

  async createCustomer(input: CreateAsaasCustomerInput): Promise<CreatedAsaasCustomer> {
    const externalReference = resolveExternalReference(input)

    const payload = {
      name: input.name,
      email: input.email,
      cpfCnpj: input.cpfCnpj,
      phone: input.phone,
      mobilePhone: input.mobilePhone,
      postalCode: input.postalCode,
      address: input.address,
      addressNumber: input.addressNumber,
      complement: input.complement,
      province: input.province,
      observations: input.observations,
      // Fixados aqui — nunca lidos do input (ver IAsaasCustomerGateway).
      externalReference,
      notificationDisabled: true,
    }

    const customer = await asaasFetch(asaasApi.customers, {
      method: "POST",
      body: JSON.stringify(payload),
    })

    const customerId = customer?.id
    if (!customerId) {
      throw new Error(
        `Asaas não retornou um ID válido para o cliente criado (externalReference: ${externalReference})`
      )
    }

    return { id: String(customerId) }
  }
}

export const asaasCustomerGateway = new AsaasCustomerGateway()
