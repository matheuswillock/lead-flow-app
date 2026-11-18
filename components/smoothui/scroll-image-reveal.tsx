"use client"

import { motion, useReducedMotion, useScroll, useSpring, useTransform } from "motion/react"
import { useRef, type RefObject } from "react"

export type ScrollImageRevealMask = "wipe" | "curtain" | "circle" | "blinds" | "scale"

export type ScrollImageRevealProps = {
  src: string
  alt: string
  mask?: ScrollImageRevealMask
  /** Rolagem de um ancestral com altura definida e overflow-y-auto. Padrão: janela. */
  container?: RefObject<HTMLElement | null>
  /** Depois de revelada, a imagem não volta a ser escondida. */
  once?: boolean
  /** Distância do paralaxe, em % da altura. A imagem é ampliada nessa medida para não expor fundo. */
  parallax?: number
  className?: string
}

/** Máscara do quadro (não da imagem), a partir do progresso 0 → 1. */
function maskFor(mask: ScrollImageRevealMask, p: number): string {
  const falta = 1 - p
  switch (mask) {
    case "wipe":
      return `inset(0 ${falta * 100}% 0 0)`
    case "curtain":
      return `inset(0 ${falta * 50}% 0 ${falta * 50}%)`
    case "circle":
      return `circle(${p * 75}% at 50% 50%)`
    case "blinds":
      return `inset(0 0 ${falta * 100}% 0)`
    case "scale":
      return "inset(0 0 0 0)"
  }
}

export function ScrollImageReveal({
  src,
  alt,
  mask = "wipe",
  container,
  once = false,
  parallax = 8,
  className,
}: ScrollImageRevealProps) {
  const frameRef = useRef<HTMLDivElement>(null)
  const reduce = useReducedMotion()

  const { scrollYProgress } = useScroll({
    target: frameRef,
    container: container,
    offset: ["start end", "end start"],
  })
  const progresso = useSpring(scrollYProgress, { stiffness: 120, damping: 30, restDelta: 0.001 })

  // "once": depois de revelada, a imagem fica aberta mesmo que a rolagem volte.
  const revelada = useRef(false)
  const efetivo = useTransform(progresso, (v) => {
    if (!once) return v
    if (v >= 0.98) revelada.current = true
    return revelada.current ? 1 : v
  })

  const clip = useTransform(efetivo, (v) => maskFor(mask, v))
  const escala = useTransform(efetivo, (v) => (mask === "scale" ? 1.08 - v * 0.08 : 1))
  const opacidade = useTransform(efetivo, (v) => (mask === "scale" ? Math.min(1, v * 1.4) : 1))
  const deslocamento = useTransform(efetivo, (v) => `${(0.5 - v) * parallax * 2}%`)

  if (reduce) {
    return (
      <div ref={frameRef} className={`relative overflow-hidden ${className ?? ""}`}>
        <img src={src} alt={alt} className="block h-full w-full object-cover" />
      </div>
    )
  }

  return (
    <div ref={frameRef} className={`relative overflow-hidden ${className ?? ""}`}>
      <motion.div className="absolute inset-0" style={{ clipPath: clip }}>
        <motion.img
          src={src}
          alt={alt}
          className="absolute left-0 w-full object-cover"
          style={{
            top: `-${parallax}%`,
            height: `${100 + parallax * 2}%`,
            translateY: deslocamento,
            scale: escala,
            opacity: opacidade,
          }}
        />
      </motion.div>
    </div>
  )
}
