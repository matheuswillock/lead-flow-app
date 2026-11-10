import { DEFAULT_TZ } from "./DEFAULT_TZ"
import { resolveTimezone } from "./validators"

export interface TimezoneOption {
  value: string
  label: string
  description: string
}

/**
 * Os quatro fusos do Brasil (nenhum tem horário de verão desde 2019). O rótulo lista os estados para o
 * corretor achar o próprio sem saber o nome da cidade-referência do fuso.
 */
const BRAZIL_TIMEZONE_OPTIONS: ReadonlyArray<TimezoneOption> = [
  {
    value: DEFAULT_TZ,
    label: "Brasília (UTC-03) — SP, RJ, MG, ES, PR, SC, RS, GO, DF",
    description: "Horário de Brasília, padrão do sistema.",
  },
  {
    value: "America/Bahia",
    label: "Brasília (UTC-03) — BA",
    description: "Mesmo horário de Brasília.",
  },
  {
    value: "America/Fortaleza",
    label: "Brasília (UTC-03) — CE, MA, PI, RN, PB",
    description: "Mesmo horário de Brasília.",
  },
  {
    value: "America/Recife",
    label: "Brasília (UTC-03) — PE",
    description: "Mesmo horário de Brasília.",
  },
  {
    value: "America/Maceio",
    label: "Brasília (UTC-03) — AL, SE",
    description: "Mesmo horário de Brasília.",
  },
  {
    value: "America/Belem",
    label: "Brasília (UTC-03) — PA, AP",
    description: "Mesmo horário de Brasília.",
  },
  {
    value: "America/Araguaina",
    label: "Brasília (UTC-03) — TO",
    description: "Mesmo horário de Brasília.",
  },
  {
    value: "America/Noronha",
    label: "Fernando de Noronha (UTC-02)",
    description: "Uma hora a mais que Brasília.",
  },
  {
    value: "America/Campo_Grande",
    label: "Amazonas (UTC-04) — MS",
    description: "Uma hora a menos que Brasília.",
  },
  {
    value: "America/Cuiaba",
    label: "Amazonas (UTC-04) — MT",
    description: "Uma hora a menos que Brasília.",
  },
  {
    value: "America/Manaus",
    label: "Amazonas (UTC-04) — AM",
    description: "Uma hora a menos que Brasília (oeste do AM, veja Acre).",
  },
  {
    value: "America/Porto_Velho",
    label: "Amazonas (UTC-04) — RO",
    description: "Uma hora a menos que Brasília.",
  },
  {
    value: "America/Boa_Vista",
    label: "Amazonas (UTC-04) — RR",
    description: "Uma hora a menos que Brasília.",
  },
  {
    value: "America/Rio_Branco",
    label: "Acre (UTC-05) — AC e oeste do AM",
    description: "Duas horas a menos que Brasília.",
  },
]

export const PROFILE_TIMEZONE_OPTIONS: ReadonlyArray<TimezoneOption> = [
  ...BRAZIL_TIMEZONE_OPTIONS,
  {
    value: "America/New_York",
    label: "Nova York",
    description: "Eastern Time (UTC-05 / UTC-04 no horário de verão).",
  },
  {
    value: "Europe/London",
    label: "Londres",
    description: "GMT / BST (UTC+00 / UTC+01 no horário de verão).",
  },
]

export function getTimezoneOption(timezone: string): TimezoneOption | undefined {
  return PROFILE_TIMEZONE_OPTIONS.find((option) => option.value === timezone)
}

export function getTimezoneDisplayName(timezone: string): string {
  return getTimezoneOption(timezone)?.label ?? timezone
}

export function getProfileTimezoneOptions(timezone?: string | null): TimezoneOption[] {
  const resolvedTimezone = resolveTimezone(timezone)
  const currentOption = getTimezoneOption(resolvedTimezone)

  if (currentOption) {
    return [...PROFILE_TIMEZONE_OPTIONS]
  }

  return [
    {
      value: resolvedTimezone,
      label: resolvedTimezone,
      description: "Timezone atual salva na conta. Você pode trocar para uma das opções padrão abaixo.",
    },
    ...PROFILE_TIMEZONE_OPTIONS,
  ]
}
