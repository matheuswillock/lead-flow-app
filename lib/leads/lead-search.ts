type LeadSearchFields = {
  name: string
  leadCode: string
  email?: string | null
  createdAt: string
}

export function leadMatchesSearch(lead: LeadSearchFields, search: string, formattedCreatedAt?: string): boolean {
  const normalizedSearch = search.trim().toLowerCase()
  if (!normalizedSearch) return true

  return [lead.name, lead.leadCode, lead.email ?? "", formattedCreatedAt ?? lead.createdAt]
    .some((value) => value.toLowerCase().includes(normalizedSearch))
}
