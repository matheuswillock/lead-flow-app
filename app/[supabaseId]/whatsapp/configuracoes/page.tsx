import { WhatsAppSettingsContext } from './features/context/WhatsAppSettingsContext'
import { WhatsAppSettingsContainer } from './features/container/WhatsAppSettingsContainer'

export default async function WhatsAppSettingsPage({
  params,
}: {
  params: Promise<{ supabaseId: string }>
}) {
  const { supabaseId } = await params
  return (
    <WhatsAppSettingsContext supabaseId={supabaseId}>
      <WhatsAppSettingsContainer />
    </WhatsAppSettingsContext>
  )
}
