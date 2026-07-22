"use client"

import { PublicFormRenderer } from "@/components/public-forms/PublicFormRenderer"
import { Skeleton } from "@/components/ui/skeleton"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { usePublicFormViewContext } from "../context/PublicFormViewContext"

export function PublicFormViewContainer() {
  const { publicId, snapshot, error, isLoading } = usePublicFormViewContext()

  if (error) {
    return (
      <main className="public-form-page light grid min-h-dvh place-items-center bg-background px-4 py-[20dvh]">
        <Alert className="max-w-md" variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      </main>
    )
  }

  if (isLoading || !snapshot) {
    return (
      <main className="public-form-page light grid min-h-dvh place-items-center bg-background px-4 py-[20dvh]">
        <Skeleton className="min-h-[60dvh] w-full max-w-[580px]" />
      </main>
    )
  }

  return (
    <main className="public-form-page light grid min-h-dvh place-items-center bg-background px-4 py-[20dvh]">
      <PublicFormRenderer
        snapshot={snapshot}
        publicId={publicId}
        className="min-h-[60dvh] w-full max-w-[580px]"
      />
    </main>
  )
}
