import { WhatsAppInboxProvider } from './features/context/WhatsAppInboxContext'
import { WhatsAppInboxContainer } from './features/container/WhatsAppInboxContainer'

interface PageProps {
  params: Promise<{ supabaseId: string }>
}

export default async function WhatsAppInboxPage({ params }: PageProps) {
  const { supabaseId } = await params

  return (
    <WhatsAppInboxProvider supabaseId={supabaseId}>
      <WhatsAppInboxContainer supabaseId={supabaseId} />
    </WhatsAppInboxProvider>
  )
}
