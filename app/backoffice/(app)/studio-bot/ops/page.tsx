"use client"

import { Suspense, useMemo } from "react"
import { Skeleton } from "@/components/ui/skeleton"
import { BackofficeStudioBotOpsProvider } from "./features/context/BackofficeStudioBotOpsContext"
import { BackofficeStudioBotOpsContainer } from "./features/container/BackofficeStudioBotOpsContainer"
import { BackofficeStudioBotOpsService } from "./features/services/BackofficeStudioBotOpsService"

export default function BackofficeStudioBotOpsPage() {
  const service = useMemo(() => new BackofficeStudioBotOpsService(), [])

  return (
    <BackofficeStudioBotOpsProvider service={service}>
      <Suspense fallback={<Skeleton className="m-4 h-64 w-full" />}>
        <BackofficeStudioBotOpsContainer />
      </Suspense>
    </BackofficeStudioBotOpsProvider>
  )
}
