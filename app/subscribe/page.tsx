// app/subscribe/page.tsx
import { Metadata } from 'next';
import { SubscriptionContainer } from './features/container/SubscriptionContainer';
import { createPublicPageMetadata } from '@/lib/metadata/policies';

const subscribeTitle = 'Assinar Corretor Studio | Plataforma de Gestão de Leads';
const subscribeDescription = 'Assine o Corretor Studio (login necessário) e comece a gerenciar seus leads de forma profissional. R$ 59,90/mês.';

export const metadata: Metadata = {
  ...createPublicPageMetadata({
    title: subscribeTitle,
    description: subscribeDescription,
    canonicalPath: '/subscribe',
    keywords: [
      "assinatura crm corretor de saude",
      "plano corretor studio",
      "crm para corretora de saude",
    ],
  }),
};

export default function SubscribePage() {
  return (
    <main className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20">
      <SubscriptionContainer />
    </main>
  );
}
