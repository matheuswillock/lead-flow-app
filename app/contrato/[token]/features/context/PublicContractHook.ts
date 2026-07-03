"use client"

import { usePublicContractContext } from "./PublicContractContext"

export function usePublicContract() {
  return usePublicContractContext()
}
