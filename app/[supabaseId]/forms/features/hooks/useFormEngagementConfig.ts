"use client"

import { useEffect, useRef, useState } from "react"
import { API_CLIENT_BASE } from "@/lib/route-map"
import type { FormEngagementConfig } from "@/lib/public-forms/temperature-preview"
import type { FormEngagementScoreRule } from "@/lib/radar/engagement-score"
import type { EngagementConfig } from "@/lib/radar/engagement-score"

type EngagementConfigResponse = {
  isValid?: boolean
  result?: {
    formCompletedBaseWeight: number
    formEngagementScoreRules: FormEngagementScoreRule[]
    engagementConfig?: EngagementConfig
  }
}

export function useFormEngagementConfig(enabled = true) {
  const [config, setConfig] = useState<FormEngagementConfig | null>(null)
  const [isLoading, setIsLoading] = useState(enabled)
  const inFlightRef = useRef(false)
  const loadedRef = useRef(false)

  useEffect(() => {
    if (!enabled || loadedRef.current || inFlightRef.current) return

    inFlightRef.current = true
    setIsLoading(true)

    void fetch(`${API_CLIENT_BASE}/forms/engagement-config`, {
      cache: "no-store",
    })
      .then(async (res) => {
        if (!res.ok) return
        const json = (await res.json()) as EngagementConfigResponse
        if (!json.isValid || !json.result) return
        setConfig({
          formCompletedBaseWeight: json.result.formCompletedBaseWeight,
          formEngagementScoreRules: json.result.formEngagementScoreRules,
          engagementConfig: json.result.engagementConfig,
        })
        loadedRef.current = true
      })
      .catch(() => {
        // preview opcional — silencioso
      })
      .finally(() => {
        setIsLoading(false)
        inFlightRef.current = false
      })
  }, [enabled])

  return { config, isLoading }
}
