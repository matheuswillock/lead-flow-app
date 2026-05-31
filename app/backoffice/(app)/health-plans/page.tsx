"use client"

import { BackofficeHealthPlansProvider } from "./features/context/BackofficeHealthPlansContext"
import { BackofficeHealthPlansContainer } from "./features/container/BackofficeHealthPlansContainer"
import { BackofficeHealthPlansService } from "./features/services/BackofficeHealthPlansService"

const service = new BackofficeHealthPlansService()

export default function BackofficeHealthPlansPage() {
  return (
    <BackofficeHealthPlansProvider service={service}>
      <BackofficeHealthPlansContainer />
    </BackofficeHealthPlansProvider>
  )
}
