import { prisma } from "@/app/api/infra/data/prisma"
import {
  assertProviderIdentityBindingImmutable,
  createProviderIdentityKey,
  type ProviderIdentityBinding,
} from "@/lib/payment-provider/identity"
import type {
  IPaymentProviderIdentityRepository,
  ProviderIdentityLookup,
  ProviderIdentityRecord,
} from "./IPaymentProviderIdentityRepository"

const identitySelect = {
  id: true,
  providerKey: true,
  environment: true,
  externalAccountContext: true,
  externalId: true,
  identityType: true,
  ownerType: true,
  ownerId: true,
  tenantId: true,
  route: true,
  routeVersion: true,
  bindingRevision: true,
} as const

export class PaymentProviderIdentityRepository implements IPaymentProviderIdentityRepository {
  async bind(binding: ProviderIdentityBinding): Promise<ProviderIdentityRecord> {
    validateBinding(binding)
    const existing = await prisma.paymentProviderIdentity.findFirst({
      where: {
        providerKey: binding.provider,
        environment: binding.environment,
        externalAccountContext: binding.externalAccountContext,
        identityType: binding.identityType,
        tenantId: binding.tenantId,
        ownerType: binding.ownerType,
        ownerId: binding.ownerId,
      },
      select: identitySelect,
    })
    if (existing) {
      const current = toIdentityRecord(existing)
      assertProviderIdentityBindingImmutable(current, binding)
      if (current.routeVersion === binding.routeVersion) return current
      const updated = await prisma.paymentProviderIdentity.updateMany({
        where: { id: current.id, bindingRevision: current.bindingRevision },
        data: {
          routeVersion: binding.routeVersion,
          bindingRevision: { increment: 1 },
        },
      })
      if (updated.count !== 1) throw new Error("Binding de identidade foi atualizado em paralelo")
      const refreshed = await prisma.paymentProviderIdentity.findUniqueOrThrow({
        where: { id: current.id },
        select: identitySelect,
      })
      return toIdentityRecord(refreshed)
    }

    const created = await prisma.paymentProviderIdentity.create({
      data: {
        providerKey: binding.provider,
        environment: binding.environment,
        externalAccountContext: binding.externalAccountContext,
        externalId: binding.externalId,
        identityType: binding.identityType,
        ownerType: binding.ownerType,
        ownerId: binding.ownerId,
        tenantId: binding.tenantId,
        route: binding.route,
        routeVersion: binding.routeVersion,
      },
      select: identitySelect,
    })
    return toIdentityRecord(created)
  }

  async find(input: ProviderIdentityLookup): Promise<ProviderIdentityRecord | null> {
    assertLookupSelector(input)
    const record = await prisma.paymentProviderIdentity.findFirst({
      where: {
        tenantId: input.tenantId,
        providerKey: input.provider,
        environment: input.environment,
        externalAccountContext: input.externalAccountContext,
        identityType: input.identityType,
        ...(input.externalId ? { externalId: input.externalId } : {}),
        ...(input.ownerType && input.ownerId
          ? { ownerType: input.ownerType, ownerId: input.ownerId }
          : {}),
      },
      select: identitySelect,
    })
    return record ? toIdentityRecord(record) : null
  }
}

function validateBinding(binding: ProviderIdentityBinding): void {
  createProviderIdentityKey(binding)
  if (!binding.routeVersion.trim()) throw new Error("Binding de identidade exige versão da rota")
}

function assertLookupSelector(input: ProviderIdentityLookup): void {
  const hasExternalId = Boolean(input.externalId)
  const hasOwner = Boolean(input.ownerType && input.ownerId)
  if (hasExternalId === hasOwner) {
    throw new Error("Lookup de identidade exige exatamente um seletor completo")
  }
  if ((input.ownerType && !input.ownerId) || (!input.ownerType && input.ownerId)) {
    throw new Error("Lookup de identidade exige ownerType e ownerId juntos")
  }
}

function toIdentityRecord(record: {
  id: string
  providerKey: string
  environment: string
  externalAccountContext: string
  externalId: string
  identityType: string
  ownerType: string
  ownerId: string
  tenantId: string
  route: string
  routeVersion: string
  bindingRevision: number
}): ProviderIdentityRecord {
  return {
    id: record.id,
    provider: record.providerKey as ProviderIdentityRecord["provider"],
    environment: record.environment as ProviderIdentityRecord["environment"],
    externalAccountContext: record.externalAccountContext,
    externalId: record.externalId,
    identityType: record.identityType as ProviderIdentityRecord["identityType"],
    ownerType: record.ownerType,
    ownerId: record.ownerId,
    tenantId: record.tenantId,
    route: record.route as ProviderIdentityRecord["route"],
    routeVersion: record.routeVersion,
    bindingRevision: record.bindingRevision,
  }
}

export const paymentProviderIdentityRepository = new PaymentProviderIdentityRepository()
