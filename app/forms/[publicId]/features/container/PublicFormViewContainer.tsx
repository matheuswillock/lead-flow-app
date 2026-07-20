"use client"

import { PublicFormRenderer } from "@/components/public-forms/PublicFormRenderer"
import { Skeleton } from "@/components/ui/skeleton"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { usePublicFormViewContext } from "../context/PublicFormViewContext"

export function PublicFormViewContainer() {
  const { publicId, snapshot, error, isLoading } = usePublicFormViewContext()

  if (error) {
    return (
      <main className="grid min-h-dvh place-items-center p-6">
        <Alert className="max-w-md" variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      </main>
    )
  }

  if (isLoading || !snapshot) {
    return (
      <main className="grid min-h-dvh place-items-center p-6">
        <Skeleton className="h-[520px] w-full max-w-2xl" />
      </main>
    )
  }

  return (
    <main className="min-h-dvh">
      <PublicFormRenderer snapshot={snapshot} publicId={publicId} />
    </main>
  )
}
