import { EmailSettingsProvider } from "./features/context/EmailSettingsContext"
import { EmailSettingsContainer } from "./features/container/EmailSettingsContainer"

type Props = { params: Promise<{ supabaseId: string }> }

export default async function EmailConfiguracoesPage({ params }: Props) {
  await params
  return (
    <EmailSettingsProvider>
      <div className="min-h-screen bg-[color:var(--surface-0)]">
        <div className="mx-auto flex w-full max-w-5xl flex-col px-4 py-8 md:px-6 md:py-10">
        <EmailSettingsContainer />
        </div>
      </div>
    </EmailSettingsProvider>
  )
}
