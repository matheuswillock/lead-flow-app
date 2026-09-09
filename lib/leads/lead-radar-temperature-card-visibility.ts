/**
 * Item D do registro 03/09 (owner): o card "Temperatura Radar" no painel
 * "Informações do lead" só pode renderizar (e, por consequência, buscar a
 * temperatura) quando o time tem acesso à feature `radar` — o mesmo gate
 * (`hasAccess(FEATURE_SLUGS.RADAR)`) usado pela sidebar. Sem acesso: card
 * oculto, não desabilitado, e zero fetch — o componente sequer monta.
 */
export function shouldRenderLeadRadarTemperatureCard(input: {
  hasRadarAccess: boolean
  hasLeadContext: boolean
}): boolean {
  return input.hasRadarAccess && input.hasLeadContext
}
