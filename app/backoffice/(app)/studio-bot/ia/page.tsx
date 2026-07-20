"use client"

import { Suspense, useMemo } from "react"
import { Skeleton } from "@/components/ui/skeleton"
import { BackofficeStudioBotAiProvider } from "./features/context/BackofficeStudioBotAiContext"
import { BackofficeStudioBotAiContainer } from "./features/container/BackofficeStudioBotAiContainer"
import { BackofficeStudioBotAiService } from "./features/services/BackofficeStudioBotAiService"

export default function BackofficeStudioBotAiPage() {
  const service = useMemo(() => new BackofficeStudioBotAiService(), [])

  return (
    <BackofficeStudioBotAiProvider service={service}>
      <Suspense fallback={<Skeleton className="m-4 h-64 w-full" />}>
        <BackofficeStudioBotAiContainer />
      </Suspense>
    </BackofficeStudioBotAiProvider>
  )
}
