import type { IProjecaoRegua, Periodo } from "../context/EntregasTypes"
import type { IEntregasProjectionService } from "./IEntregasProjectionService"

/** Agendamentos por período: 3 por dia útil (20 dias úteis no mês), na mesma proporção da régua. */
const AGENDAMENTOS_POR_PERIODO: Record<Periodo, number> = {
  semana: 15,
  mes: 60,
  trimestre: 180,
}

const TAXA_NO_SHOW = 0.25

export const entregasProjectionService: IEntregasProjectionService = {
  calcular(periodo: Periodo): IProjecaoRegua {
    const agendadas = AGENDAMENTOS_POR_PERIODO[periodo]
    return { agendadas, realizadas: Math.round(agendadas * (1 - TAXA_NO_SHOW)) }
  },
}
