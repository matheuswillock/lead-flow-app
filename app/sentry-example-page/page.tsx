import { SentryExamplePageProvider } from "./features/context/SentryExamplePageContext"
import { SentryExamplePageContainer } from "./features/container/SentryExamplePageContainer"

export default function SentryExamplePage() {
  return (
    <SentryExamplePageProvider>
      <SentryExamplePageContainer />
    </SentryExamplePageProvider>
  )
}
