import {
  RADAR_SEGMENT_MAX_CONDITIONS,
  type RadarSegmentCondition,
  type RadarSegmentLeafCondition,
  type RadarSegmentRules,
} from "@/lib/radar/segment-dsl"

function isLeafCondition(condition: RadarSegmentCondition): condition is RadarSegmentLeafCondition {
  return condition.kind !== "condition_group"
}

/**
 * Converte regras do segmento pai em condições base para merge hierárquico.
 * Top-level `match: "any"` vira um `condition_group` para preservar semântica OR.
 */
export function parentRulesToBaseConditions(parentRules: RadarSegmentRules): RadarSegmentCondition[] {
  if (parentRules.conditions.length === 0) return []
  if (parentRules.match === "all") {
    return parentRules.conditions
  }
  const leafConditions = parentRules.conditions.filter(isLeafCondition)
  if (leafConditions.length === 0) return []
  return [{ kind: "condition_group", match: parentRules.match, conditions: leafConditions }]
}

/**
 * Mescla condições base (campanha ou pai) com regras adicionais do usuário.
 * Base sempre combina em AND; adicionais respeitam Todas/Qualquer via `condition_group` quando OR.
 */
export function mergeHierarchicalSegmentRules(
  baseConditions: RadarSegmentCondition[],
  additionalRules?: { match: "all" | "any"; conditions: RadarSegmentCondition[] }
): RadarSegmentRules {
  const additional = additionalRules ?? { match: "all" as const, conditions: [] }

  let additionalPart: RadarSegmentCondition[] = []
  if (additional.conditions.length > 0) {
    const leafAdditional = additional.conditions.filter(isLeafCondition)
    if (additional.match === "any" && leafAdditional.length > 1) {
      additionalPart = [{ kind: "condition_group", match: "any", conditions: leafAdditional }]
    } else {
      additionalPart = leafAdditional
    }
  }

  const mergedConditions = [...baseConditions, ...additionalPart]
  if (mergedConditions.length > RADAR_SEGMENT_MAX_CONDITIONS) {
    throw new Error(
      `Limite excedido: total de ${mergedConditions.length} condições (máximo ${RADAR_SEGMENT_MAX_CONDITIONS})`
    )
  }

  if (mergedConditions.length === 0) {
    throw new Error("Informe ao menos uma condição")
  }

  return { match: "all", conditions: mergedConditions }
}
