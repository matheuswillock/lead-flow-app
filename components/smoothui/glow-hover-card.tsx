"use client"

import { useReducedMotion } from "motion/react"
import { useRef, useState, type CSSProperties, type PointerEvent, type ReactNode } from "react"

export type GlowHoverCardProps = {
  children: ReactNode
  className?: string
  /** Cor do brilho em HSL, sem o hsl(): "h s% l%". Padrão: laranja do logo. */
  glowColor?: string
  /** Raio do brilho em px. */
  glowSize?: number
}

/** Card com brilho que segue o cursor. O brilho é um overlay sem interação, escondido com reduced motion. */
export function GlowHoverCard({
  children,
  className,
  glowColor = "22 100% 50%",
  glowSize = 280,
}: GlowHoverCardProps) {
  const ref = useRef<HTMLDivElement>(null)
  const reduce = useReducedMotion()
  const [ativo, setAtivo] = useState(false)

  function mover(evento: PointerEvent<HTMLDivElement>) {
    const el = ref.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    el.style.setProperty("--glow-x", `${evento.clientX - rect.left}px`)
    el.style.setProperty("--glow-y", `${evento.clientY - rect.top}px`)
  }

  const estilo = {
    "--glow-color": glowColor,
    "--glow-size": `${glowSize}px`,
  } as CSSProperties

  return (
    <div
      ref={ref}
      className={`relative overflow-hidden ${className ?? ""}`}
      style={estilo}
      onPointerEnter={() => setAtivo(true)}
      onPointerLeave={() => setAtivo(false)}
      onPointerMove={mover}
    >
      {!reduce ? (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 transition-opacity duration-300"
          style={{
            opacity: ativo ? 1 : 0,
            background:
              "radial-gradient(var(--glow-size) circle at var(--glow-x, 50%) var(--glow-y, 50%), hsl(var(--glow-color) / 0.22), transparent 70%)",
          }}
        />
      ) : null}
      <div className="relative flex min-h-full flex-1 flex-col">{children}</div>
    </div>
  )
}
