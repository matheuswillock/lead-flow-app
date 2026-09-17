"use client"

import { useEffect, useState } from "react"

/**
 * Cadência de renovação do piso. Fina o bastante para o campo vencer à vista
 * do usuário, larga o bastante para não render-thrashar o wizard aberto.
 */
const SCHEDULE_FLOOR_REFRESH_MS = 30_000

/**
 * Piso de agendamento ("agora"), renovado enquanto `active`.
 *
 * A validação de submit reavalia `new Date()` a cada render — sem um tick, um
 * wizard parado não re-renderiza e o horário que vence durante a revisão segue
 * parecendo válido até a próxima interação do usuário.
 */
export function useScheduleFloor(active: boolean): Date {
  const [floor, setFloor] = useState<Date>(() => new Date())

  useEffect(() => {
    if (!active) return
    setFloor(new Date())
    const timer = setInterval(() => setFloor(new Date()), SCHEDULE_FLOOR_REFRESH_MS)
    return () => clearInterval(timer)
  }, [active])

  return floor
}
