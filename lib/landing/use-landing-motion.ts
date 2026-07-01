"use client"

import { useReducedMotion } from "framer-motion"

type RevealAxis = "y" | "x"

type LandingRevealOptions = {
  axis?: RevealAxis
  distance?: number
  duration?: number
  delay?: number
  scale?: boolean
}

const atRest = { opacity: 1, y: 0, x: 0, scale: 1 }

export function useLandingReveal({
  axis = "y",
  distance = 16,
  duration = 0.5,
  delay = 0,
  scale = false,
}: LandingRevealOptions = {}) {
  const prefersReducedMotion = useReducedMotion()

  if (prefersReducedMotion) {
    return {
      initial: atRest,
      whileInView: atRest,
      viewport: { once: true as const },
      transition: { duration: 0 },
    }
  }

  const initial =
    axis === "y"
      ? { opacity: 1, y: distance, ...(scale ? { scale: 0.96 } : {}) }
      : { opacity: 1, x: distance, ...(scale ? { scale: 0.96 } : {}) }

  return {
    initial,
    whileInView: atRest,
    viewport: { once: true as const },
    transition: { duration, delay },
  }
}
