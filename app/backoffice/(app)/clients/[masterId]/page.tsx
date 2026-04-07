"use client"

import { useParams } from "next/navigation"
import { BackofficeClientDetailsProvider } from "./features/context/BackofficeClientDetailsContext"
import { BackofficeClientDetailsContainer } from "./features/container/BackofficeClientDetailsContainer"
import { BackofficeClientDetailsService } from "./features/services/BackofficeClientDetailsService"

const detailsService = new BackofficeClientDetailsService()

export default function BackofficeClientDetailsPage() {
  const params = useParams()
  const masterId = params.masterId as string

  return (
    <BackofficeClientDetailsProvider masterId={masterId} service={detailsService}>
      <BackofficeClientDetailsContainer />
    </BackofficeClientDetailsProvider>
  )
}
