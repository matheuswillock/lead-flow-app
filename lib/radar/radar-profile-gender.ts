import type { RadarGender } from "@/lib/radar/gender"

export const RADAR_PROFILE_GENDER_VALUES = ["male", "female", "unknown"] as const satisfies readonly RadarGender[]

export const RADAR_PROFILE_GENDER_LABELS: Record<(typeof RADAR_PROFILE_GENDER_VALUES)[number], string> = {
  male: "Masculino",
  female: "Feminino",
  unknown: "Indefinido",
}

export function isRadarProfileGenderValue(value: string): value is (typeof RADAR_PROFILE_GENDER_VALUES)[number] {
  return (RADAR_PROFILE_GENDER_VALUES as readonly string[]).includes(value)
}
