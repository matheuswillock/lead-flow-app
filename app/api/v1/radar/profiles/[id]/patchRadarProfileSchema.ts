import { z } from "zod"
import { RADAR_PROFILE_GENDER_VALUES } from "@/lib/radar/radar-profile-gender"

export const patchRadarProfileSchema = z.object({
  gender: z.enum(RADAR_PROFILE_GENDER_VALUES),
})

export type PatchRadarProfileRequest = z.infer<typeof patchRadarProfileSchema>
