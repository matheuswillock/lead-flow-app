"use client"

import { useExpiredAdhesionContext } from "./ExpiredAdhesionContext"

export function useExpiredAdhesion() {
  return useExpiredAdhesionContext()
}
