import { Suspense } from "react"
import { RadarProvider } from "./features/context/RadarContext"
import { RadarContainer } from "./features/container/RadarContainer"

export default function RadarPage() {
  return (
    <Suspense>
      <RadarProvider>
        <div className="container mx-auto p-6">
          <RadarContainer />
        </div>
      </RadarProvider>
    </Suspense>
  )
}
