import { RadarProvider } from "./features/context/RadarContext"
import { RadarContainer } from "./features/container/RadarContainer"

export default function RadarPage() {
  return (
    <RadarProvider>
      <div className="container mx-auto p-6">
        <RadarContainer />
      </div>
    </RadarProvider>
  )
}
