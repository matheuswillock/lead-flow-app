export type Periodo = "semana" | "mes" | "trimestre"

export interface IProjecaoRegua {
  agendadas: number
  realizadas: number
}

export interface IEntregasState {
  periodo: Periodo
  setPeriodo: (periodo: Periodo) => void
  projecao: IProjecaoRegua
}
