export type RadarGender = "male" | "female" | "unknown"
export type RadarGenderSource = "mapped" | "inferred" | "manual"

export type GenderState = {
  gender: RadarGender | null
  genderSource: RadarGenderSource | null
}

export type GenderCandidate = {
  gender: RadarGender | null
  source: "mapped" | "inferred"
}

function isUsefulCandidate(candidate: GenderCandidate): candidate is {
  gender: "male" | "female"
  source: "mapped" | "inferred"
} {
  return candidate.gender === "male" || candidate.gender === "female"
}

export function resolveGender(
  current: GenderState,
  candidate: GenderCandidate
): GenderState | null {
  if (!isUsefulCandidate(candidate)) {
    return null
  }

  if (current.genderSource === "manual") {
    return null
  }

  if (candidate.source === "inferred") {
    if (current.genderSource === "mapped") {
      return null
    }
  }

  if (
    current.gender === candidate.gender &&
    current.genderSource === candidate.source
  ) {
    return null
  }

  return {
    gender: candidate.gender,
    genderSource: candidate.source,
  }
}

/** Guard SQL para update atômico: `null` = sem filtro (escrita `manual`). */
export function allowedCurrentSourcesForGenderWrite(
  incoming: RadarGenderSource
): { allowNull: boolean; sources: RadarGenderSource[] } | null {
  if (incoming === "manual") {
    return null
  }

  if (incoming === "mapped") {
    return { allowNull: true, sources: ["inferred", "mapped"] }
  }

  return { allowNull: true, sources: ["inferred"] }
}
