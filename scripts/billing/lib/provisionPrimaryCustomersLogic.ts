import type { AsaasCustomer } from "./asaasInventoryTypes"

export type CustomerProvisioningTarget = {
  name: string
  email: string
}

export type ProvisioningProfile = {
  id: string
  fullName: string | null
  email: string
  cpfCnpj: string | null
  phone: string | null
  postalCode: string | null
  address: string | null
  addressNumber: string | null
  complement: string | null
  neighborhood: string | null
  asaasCustomerId: string | null
  asaasCustomerAccount: "primary" | "legacy"
}

export type CustomerProvisioningAction =
  | "create"
  | "link-existing"
  | "already-linked"
  | "blocked"

export type CustomerProvisioningPlan = {
  target: CustomerProvisioningTarget
  profileId: string | null
  action: CustomerProvisioningAction
  customerId: string | null
  reason: string
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase()
}

function normalizeName(name: string): string {
  return name.trim().replace(/\s+/g, " ").toLocaleLowerCase("pt-BR")
}

function normalizeDocument(document: string | null | undefined): string | null {
  if (!document) return null
  const normalized = document.replace(/\D/g, "")
  return normalized.length > 0 ? normalized : null
}

function findUnique<T>(items: T[], predicate: (item: T) => boolean): T | null {
  const matches = items.filter(predicate)
  return matches.length === 1 ? matches[0] : null
}

function findCustomerForProfile(
  profile: ProvisioningProfile,
  target: CustomerProvisioningTarget,
  customers: AsaasCustomer[]
): { customer: AsaasCustomer | null; reason: string } {
  let stalePointerReason: string | null = null
  if (profile.asaasCustomerId) {
    if (profile.asaasCustomerAccount !== "primary") {
      stalePointerReason = `ponteiro local ${profile.asaasCustomerId} pertence à conta ${profile.asaasCustomerAccount}; `
    } else {
      const pointedCustomer = customers.find((customer) => customer.id === profile.asaasCustomerId)
      if (!pointedCustomer) {
        stalePointerReason = `ponteiro local ${profile.asaasCustomerId} não existe na conta primary; `
      } else {
        return { customer: pointedCustomer, reason: "ponteiro local já aponta para a conta primary" }
      }
    }
  }

  const externalReferenceCustomer = findUnique(
    customers,
    (customer) => customer.externalReference === profile.id && !customer.deleted
  )
  if (externalReferenceCustomer) {
    return {
      customer: externalReferenceCustomer,
      reason: `${stalePointerReason ?? ""}externalReference corresponde ao profile`,
    }
  }

  const emailCustomer = findUnique(
    customers,
    (customer) => normalizeEmail(customer.email) === normalizeEmail(target.email) && !customer.deleted
  )
  if (emailCustomer) {
    return {
      customer: emailCustomer,
      reason: `${stalePointerReason ?? ""}e-mail da base corresponde ao customer`,
    }
  }

  const profileDocument = normalizeDocument(profile.cpfCnpj)
  const documentCustomer = profileDocument
    ? findUnique(
        customers,
        (customer) => normalizeDocument(customer.cpfCnpj) === profileDocument && !customer.deleted
      )
    : null
  if (documentCustomer) {
    return {
      customer: documentCustomer,
      reason: `${stalePointerReason ?? ""}CPF/CNPJ do profile corresponde ao customer`,
    }
  }

  const nameMatches = customers.filter(
    (customer) => normalizeName(customer.name) === normalizeName(target.name) && !customer.deleted
  )
  if (nameMatches.length === 1) {
    return {
      customer: nameMatches[0],
      reason: `${stalePointerReason ?? ""}nome único corresponde; e-mail será reconciliado com a base`,
    }
  }
  if (nameMatches.length > 1) {
    return { customer: null, reason: "há múltiplos customers com o mesmo nome" }
  }

  return {
    customer: null,
    reason: `${stalePointerReason ?? ""}nenhum customer primary corresponde à base`,
  }
}

export function planCustomerProvisioning(input: {
  targets: CustomerProvisioningTarget[]
  profiles: ProvisioningProfile[]
  customers: AsaasCustomer[]
}): CustomerProvisioningPlan[] {
  const profilesByEmail = new Map<string, ProvisioningProfile[]>()
  for (const profile of input.profiles) {
    const email = normalizeEmail(profile.email)
    const profiles = profilesByEmail.get(email) ?? []
    profiles.push(profile)
    profilesByEmail.set(email, profiles)
  }

  return input.targets.map((target) => {
    const normalizedTargetEmail = normalizeEmail(target.email)
    const matchingProfiles = profilesByEmail.get(normalizedTargetEmail) ?? []
    if (matchingProfiles.length !== 1) {
      return {
        target,
        profileId: matchingProfiles[0]?.id ?? null,
        action: "blocked",
        customerId: null,
        reason:
          matchingProfiles.length === 0
            ? "nenhum profile local corresponde ao e-mail da base"
            : "múltiplos profiles locais correspondem ao e-mail da base",
      }
    }

    const profile = matchingProfiles[0]
    const match = findCustomerForProfile(profile, target, input.customers)
    if (profile.asaasCustomerId && profile.asaasCustomerAccount === "primary" && !match.customer) {
      return {
        target,
        profileId: profile.id,
        action: "blocked",
        customerId: null,
        reason: match.reason,
      }
    }
    if (match.customer) {
      const alreadyLinked =
        profile.asaasCustomerId === match.customer.id && profile.asaasCustomerAccount === "primary"
      return {
        target,
        profileId: profile.id,
        action: alreadyLinked ? "already-linked" : "link-existing",
        customerId: match.customer.id,
        reason: match.reason,
      }
    }

    return {
      target,
      profileId: profile.id,
      action: "create",
      customerId: null,
      reason: match.reason,
    }
  })
}

export type ProvisioningArgs = {
  input: string
  output?: string
  apply: boolean
}

export function parseProvisioningArgs(argv: string[]): ProvisioningArgs {
  const input = argv.find((argument) => argument.startsWith("--input="))?.slice("--input=".length)
  if (!input) throw new Error("--input=<path> é obrigatório")
  return {
    input,
    output: argv.find((argument) => argument.startsWith("--output="))?.slice("--output=".length),
    apply: argv.includes("--apply"),
  }
}

export function assertProvisioningApplyAuthorized(
  args: ProvisioningArgs,
  env: Record<string, string | undefined>
): void {
  if (!args.apply) return
  if (env.ASAAS_PRIMARY_CUSTOMERS_APPLY !== "1") {
    throw new Error(
      "Recusado: --apply exige ASAAS_PRIMARY_CUSTOMERS_APPLY=1 para criar ou vincular customers na conta primary"
    )
  }
  if (env.ASAAS_ENV !== "production") {
    throw new Error("Recusado: provisionamento da conta primary exige ASAAS_ENV=production")
  }
}
