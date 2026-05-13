"use client"

import { BackofficeBetaProvider } from "./features/context/BackofficeBetaContext"
import { BackofficeBetaContainer } from "./features/container/BackofficeBetaContainer"
import { BackofficeBetaService } from "./features/services/BackofficeBetaService"

const betaService = new BackofficeBetaService()

export default function BackofficeBetaPage() {
  return (
    <BackofficeBetaProvider betaService={betaService}>
      <BackofficeBetaContainer />
    </BackofficeBetaProvider>
  )
}
