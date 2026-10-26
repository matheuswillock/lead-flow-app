"use client"

import { useEffect, useRef } from "react"
import type { ReactNode } from "react"

export type PublicTrackingScriptsValue = {
  headScripts: string | null
  bodyStartScripts: string | null
  bodyEndScripts: string | null
}

function ScriptMarkup({ value }: { value: string | null }) {
  if (!value) return null
  const container = useRef<HTMLSpanElement>(null)
  useEffect(() => {
    if (!container.current) return
    const fragment = document.createRange().createContextualFragment(value)
    const scripts = Array.from(fragment.querySelectorAll("script"))
    for (const script of scripts) {
      const executable = document.createElement("script")
      for (const attribute of Array.from(script.attributes)) executable.setAttribute(attribute.name, attribute.value)
      executable.textContent = script.textContent
      script.replaceWith(executable)
    }
    container.current.appendChild(fragment)
    return () => { container.current?.replaceChildren() }
  }, [value])
  return <span ref={container} aria-hidden="true" />
}

export function PublicTrackingHead({ tracking }: { tracking: PublicTrackingScriptsValue | null }) {
  return tracking?.headScripts ? <ScriptMarkup value={tracking.headScripts} /> : null
}

export function PublicTrackingBody({ tracking, position }: { tracking: PublicTrackingScriptsValue | null; position: "start" | "end" }): ReactNode {
  if (!tracking) return null
  return <ScriptMarkup value={position === "start" ? tracking.bodyStartScripts : tracking.bodyEndScripts} />
}
