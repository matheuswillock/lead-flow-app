import { EmailSettingsProvider } from "./features/context/EmailSettingsContext"
import { EmailSettingsContainer } from "./features/container/EmailSettingsContainer"

type Props = { params: Promise<{ supabaseId: string }> }

export default async function EmailConfiguracoesPage({ params }: Props) {
  await params
  return (
    <EmailSettingsProvider>
      <div className="container mx-auto p-6 space-y-6">
        <EmailSettingsContainer />
      </div>
    </EmailSettingsProvider>
  )
}
