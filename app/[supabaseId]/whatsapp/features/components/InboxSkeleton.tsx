"use client"

import { Skeleton } from '@/components/ui/skeleton'
import { MessageBubbleSkeleton } from './MessageBubbleSkeleton'

export function InboxSkeleton() {
  return (
    <div className="flex h-[calc(100vh-theme(spacing.16))] overflow-hidden border rounded-lg border-border">
      {/* Left column skeleton */}
      <div className="flex w-80 flex-col gap-2 border-r border-border p-3">
        <Skeleton className="h-9 w-full rounded-md" />
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex gap-3 p-2">
            <Skeleton className="size-10 shrink-0 rounded-full" />
            <div className="flex flex-1 flex-col gap-1.5">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-3 w-full" />
            </div>
          </div>
        ))}
      </div>

      {/* Right column skeleton */}
      <div className="flex flex-1 flex-col gap-4 p-4">
        <div className="flex items-center gap-3 border-b border-border pb-3">
          <Skeleton className="size-9 rounded-full" />
          <div className="flex flex-col gap-1">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-3 w-24" />
          </div>
        </div>
        <div className="flex flex-1 flex-col gap-3">
          <MessageBubbleSkeleton />
        </div>
        <Skeleton className="h-12 w-full rounded-md" />
      </div>
    </div>
  )
}
