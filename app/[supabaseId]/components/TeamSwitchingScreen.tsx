"use client"

import { Loader2 } from "lucide-react"
import { motion, useReducedMotion } from "framer-motion"

export const TEAM_SWITCHING_SUPPORT_COPY =
  "Atualizando campanhas, permissões e dados deste time."

export function getTeamSwitchingTitle(teamName: string | null): string {
  const name = teamName?.trim()
  return name ? `Migrando para o time ${name}` : "Migrando para o time"
}

interface TeamSwitchingScreenProps {
  teamName: string | null
}

export function TeamSwitchingScreen({ teamName }: TeamSwitchingScreenProps) {
  const prefersReducedMotion = useReducedMotion()
  const title = getTeamSwitchingTitle(teamName)

  return (
    <div
      className="flex h-screen w-full items-center justify-center bg-background"
      role="status"
      aria-live="polite"
      aria-atomic="true"
    >
      <motion.div
        className="flex max-w-md flex-col items-center gap-4 p-6 text-center"
        initial={prefersReducedMotion ? false : { opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={
          prefersReducedMotion
            ? { duration: 0 }
            : {
                duration: 0.22,
                ease: [0.16, 1, 0.3, 1],
              }
        }
      >
        <Loader2
          className="size-12 animate-spin text-primary motion-reduce:animate-none"
          aria-hidden="true"
        />
        <div className="flex flex-col gap-2">
          <h1 className="text-xl font-semibold text-foreground">{title}</h1>
          <p className="text-sm text-muted-foreground">{TEAM_SWITCHING_SUPPORT_COPY}</p>
        </div>
      </motion.div>
    </div>
  )
}
