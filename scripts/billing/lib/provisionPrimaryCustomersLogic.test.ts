import { describe, expect, it } from "bun:test"
import {
  assertProvisioningApplyAuthorized,
  planCustomerProvisioning,
  type ProvisioningProfile,
} from "./provisionPrimaryCustomersLogic"

const profile = (overrides: Partial<ProvisioningProfile> = {}): ProvisioningProfile => ({
  id: "profile-1",
  fullName: "Eduardo Rolon Gois Pinto",
  email: "eduardo.rolon@azulcorp.com.br",
  cpfCnpj: "12345678900",
  phone: null,
  postalCode: null,
  address: null,
  addressNumber: null,
  complement: null,
  neighborhood: null,
  asaasCustomerId: null,
  asaasCustomerAccount: "primary",
  ...overrides,
})

describe("planCustomerProvisioning", () => {
  it("cria somente quando não há customer correspondente", () => {
    const [plan] = planCustomerProvisioning({
      targets: [{ name: "Roberto Andrade", email: "roberto@example.com" }],
      profiles: [profile({ id: "profile-roberto", email: "roberto@example.com" })],
      customers: [],
    })

    expect(plan).toMatchObject({ action: "create", profileId: "profile-roberto" })
  })

  it("reutiliza customer por e-mail em vez de criar duplicado", () => {
    const [plan] = planCustomerProvisioning({
      targets: [{ name: "Roberto Andrade", email: "roberto@example.com" }],
      profiles: [profile({ id: "profile-roberto", email: "roberto@example.com" })],
      customers: [
        {
          id: "cus-existing",
          name: "Roberto Andrade",
          email: "ROBERTO@example.com",
          notificationDisabled: true,
        },
      ],
    })

    expect(plan).toMatchObject({ action: "link-existing", customerId: "cus-existing" })
  })

  it("reconcilia Eduardo pelo nome único quando o e-mail remoto está divergente", () => {
    const [plan] = planCustomerProvisioning({
      targets: [{ name: "Eduardo Rolon Gois Pinto", email: "eduardo.rolon@azulcorp.com.br" }],
      profiles: [profile()],
      customers: [
        {
          id: "cus-eduardo",
          name: "Eduardo Rolon Gois Pinto",
          email: "eduardo@azulcorp.com.br",
          notificationDisabled: true,
        },
      ],
    })

    expect(plan).toMatchObject({ action: "link-existing", customerId: "cus-eduardo" })
    expect(plan.reason).toContain("reconciliado")
  })

  it("bloqueia ponteiro local que não existe na primary", () => {
    const [plan] = planCustomerProvisioning({
      targets: [{ name: "Eduardo Rolon Gois Pinto", email: "eduardo.rolon@azulcorp.com.br" }],
      profiles: [profile({ asaasCustomerId: "cus-stale" })],
      customers: [],
    })

    expect(plan.action).toBe("blocked")
  })

  it("não trata ponteiro legacy com o mesmo ID como customer primary", () => {
    const [plan] = planCustomerProvisioning({
      targets: [{ name: "Eduardo Rolon Gois Pinto", email: "eduardo.rolon@azulcorp.com.br" }],
      profiles: [profile({ asaasCustomerId: "cus-collision", asaasCustomerAccount: "legacy" })],
      customers: [
        {
          id: "cus-collision",
          name: "Outro cliente",
          email: "outro@example.com",
          notificationDisabled: true,
        },
      ],
    })

    expect(plan.action).toBe("create")
  })
})

describe("assertProvisioningApplyAuthorized", () => {
  it("exige confirmação explícita e produção", () => {
    expect(() =>
      assertProvisioningApplyAuthorized(
        { input: "targets.json", apply: true },
        { ASAAS_PRIMARY_CUSTOMERS_APPLY: "1", ASAAS_ENV: "sandbox" }
      )
    ).toThrow("ASAAS_ENV=production")
  })
})
