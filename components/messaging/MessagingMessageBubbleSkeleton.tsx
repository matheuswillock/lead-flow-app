"use client"

import { cn } from "@/lib/utils"

const SKELETON_WIDTHS = ["w-48", "w-56", "w-40", "w-64"] as const

interface MessagingMessageBubbleSkeletonProps {
  count?: number
}

export function MessagingMessageBubbleSkeleton({ count = 4 }: MessagingMessageBubbleSkeletonProps) {
  return (
    <>
      {Array.from({ length: count }).map((_, index) => {
        const isOutbound = index % 2 === 0
        const widthClass = SKELETON_WIDTHS[index % SKELETON_WIDTHS.length]

        return (
          <div
            key={index}
            className={cn("flex w-full", isOutbound ? "justify-end" : "justify-start")}
          >
            <div
              className={cn(
                "flex max-w-[70%] flex-col gap-1.5 rounded-lg px-3 py-2.5 animate-pulse",
                widthClass,
                isOutbound
                  ? "rounded-br-sm bg-primary/30"
                  : "rounded-bl-sm bg-muted"
              )}
            >
              <div
                className={cn(
                  "h-2 rounded",
                  isOutbound ? "w-3/4 bg-primary-foreground/20" : "w-full bg-foreground/10"
                )}
              />
              <div
                className={cn(
                  "h-2 rounded",
                  isOutbound ? "w-1/2 bg-primary-foreground/20" : "w-2/3 bg-foreground/10"
                )}
              />
            </div>
          </div>
        )
      })}
    </>
  )
}
