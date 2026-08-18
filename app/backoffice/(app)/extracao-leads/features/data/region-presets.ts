export interface LeadExtractionRegionPreset {
  id: string
  label: string
  municipalityCodes: string[]
}

export const GRANDE_SAO_PAULO_MUNICIPALITY_CODES = [
  "3503901",
  "3505708",
  "3506607",
  "3509007",
  "3509205",
  "3510609",
  "3513009",
  "3513801",
  "3515004",
  "3515103",
  "3515707",
  "3516309",
  "3516408",
  "3518305",
  "3518800",
  "3522208",
  "3522505",
  "3523107",
  "3525003",
  "3526209",
  "3528502",
  "3529401",
  "3530607",
  "3534401",
  "3539103",
  "3539806",
  "3543303",
  "3544103",
  "3545001",
  "3546801",
  "3547304",
  "3547809",
  "3548708",
  "3548807",
  "3549953",
  "3550308",
  "3552502",
  "3552809",
  "3556453",
] as const

export const LEAD_EXTRACTION_REGION_PRESETS: LeadExtractionRegionPreset[] = [
  {
    id: "grande-sao-paulo",
    label: "Grande São Paulo",
    municipalityCodes: [...GRANDE_SAO_PAULO_MUNICIPALITY_CODES],
  },
]

export function isRegionFullySelected(
  selectedCodes: string[],
  regionCodes: readonly string[]
): boolean {
  const selected = new Set(selectedCodes)
  return regionCodes.every((code) => selected.has(code))
}
