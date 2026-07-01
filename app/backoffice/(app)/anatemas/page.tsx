"use client"

import { BackofficeAnathemasProvider } from "./features/context/BackofficeAnathemasContext"
import { BackofficeAnathemasContainer } from "./features/container/BackofficeAnathemasContainer"
import { BackofficeAnathemasService } from "./features/services/BackofficeAnathemasService"

const anatemasService = new BackofficeAnathemasService()

export default function BackofficeAnatemasPage() {
  return (
    <BackofficeAnathemasProvider service={anatemasService}>
      <BackofficeAnathemasContainer />
    </BackofficeAnathemasProvider>
  )
}
