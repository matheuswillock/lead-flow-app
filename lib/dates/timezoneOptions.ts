import { DEFAULT_TZ } from "./DEFAULT_TZ"

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
