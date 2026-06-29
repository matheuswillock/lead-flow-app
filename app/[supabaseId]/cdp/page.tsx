import { CdpProvider } from "./features/context/CdpContext"
import { CdpContainer } from "./features/container/CdpContainer"

export default function CdpPage() {
  return (
    <CdpProvider>
      <div className="container mx-auto p-6">
        <CdpContainer />
      </div>
    </CdpProvider>
  )
}
