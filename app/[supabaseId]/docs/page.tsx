import { DocsProvider } from "./features/context/DocsContext"
import { DocsContainer } from "./features/container/DocsContainer"

export default function DocsPage() {
  return (
    <DocsProvider>
      <DocsContainer />
    </DocsProvider>
  )
}
