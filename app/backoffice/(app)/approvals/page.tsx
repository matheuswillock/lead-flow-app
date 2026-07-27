"use client"

import { BackofficeApprovalsProvider } from "./features/context/BackofficeApprovalsContext"
import { BackofficeApprovalsContainer } from "./features/container/BackofficeApprovalsContainer"
import { BackofficeApprovalsService } from "./features/services/BackofficeApprovalsService"

const approvalsService = new BackofficeApprovalsService()

export default function BackofficeApprovalsPage() {
  return (
    <BackofficeApprovalsProvider service={approvalsService}>
      <BackofficeApprovalsContainer />
    </BackofficeApprovalsProvider>
  )
}
