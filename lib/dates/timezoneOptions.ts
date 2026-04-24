import { DEFAULT_TZ } from "./DEFAULT_TZ"
import { resolveTimezone } from "./validators"

export interface TimezoneOption {
  value: string
  label: string
  description: string
}

export const PROFILE_TIMEZONE_OPTIONS: ReadonlyArray<TimezoneOption> = [
  {
    value: DEFAULT_TZ,
    label: "São Paulo",
    description: "Horário do Brasil (UTC-03), padrão do sistema.",
  },
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
