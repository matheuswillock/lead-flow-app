"use client"

import { useParams } from "next/navigation"
import { BackofficeClientInvoiceDetailsProvider } from "./features/context/BackofficeClientInvoiceDetailsContext"
import { BackofficeClientInvoiceDetailsContainer } from "./features/container/BackofficeClientInvoiceDetailsContainer"
import { BackofficeClientInvoiceDetailsService } from "./features/services/BackofficeClientInvoiceDetailsService"

const service = new BackofficeClientInvoiceDetailsService()

export default function BackofficeClientInvoiceDetailsPage() {
  const params = useParams()
  const masterId = params.masterId as string
  const invoiceId = params.invoiceId as string

  return (
    <BackofficeClientInvoiceDetailsProvider
      masterId={masterId}
      invoiceId={invoiceId}
      service={service}
    >
      <BackofficeClientInvoiceDetailsContainer />
    </BackofficeClientInvoiceDetailsProvider>
  )
}
