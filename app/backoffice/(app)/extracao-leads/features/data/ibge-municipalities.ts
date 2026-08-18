import compactMunicipalities from "./ibge-municipalities.json"

export interface IbgeMunicipality {
  code: string
  name: string
  uf: string
}

interface CompactMunicipality {
  c: string
  n: string
  u: string
}

export const IBGE_MUNICIPALITIES: IbgeMunicipality[] = (
  compactMunicipalities as CompactMunicipality[]
).map((item) => ({
  code: item.c,
  name: item.n,
  uf: item.u,
}))

export function getMunicipalitiesForStates(
  states: string[],
  extraCodes: string[] = []
): IbgeMunicipality[] {
  const extra = new Set(extraCodes)
  if (states.length === 0 && extra.size === 0) {
    return []
  }
  return IBGE_MUNICIPALITIES.filter(
    (municipality) => states.includes(municipality.uf) || extra.has(municipality.code)
  )
}
