import { WhatsAppAutoResponsesContext } from './features/context/WhatsAppAutoResponsesContext'
import { WhatsAppAutoResponsesContainer } from './features/container/WhatsAppAutoResponsesContainer'

export default async function WhatsAppAutoResponsesPage({
  params,
}: {
  params: Promise<{ supabaseId: string }>
}) {
  const { supabaseId } = await params
  return (
    <WhatsAppAutoResponsesContext supabaseId={supabaseId}>
      <WhatsAppAutoResponsesContainer />
    </WhatsAppAutoResponsesContext>
  )
}
