"use client"

import { Skeleton } from "@/components/ui/skeleton"

export default function Loading() {
  return (
    <main className="mx-auto flex min-h-[60vh] w-full max-w-xl flex-col justify-center gap-3 px-6 py-10">
      <Skeleton className="h-7 w-56" />
      <Skeleton className="h-4 w-72" />
    </main>
  )
}

