import type { IProjecaoRegua, Periodo } from "../context/EntregasTypes"

export interface IEntregasProjectionService {
  calcular(periodo: Periodo): IProjecaoRegua
}
