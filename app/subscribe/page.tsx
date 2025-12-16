// app/subscribe/page.tsx
import { Metadata } from 'next';
import { SubscriptionContainer } from './features/container/SubscriptionContainer';

export const metadata: Metadata = {
  title: 'Assinar Corretor Studio | Plataforma de Gestão de Leads',
  description: 'Assine o Corretor Studio (login necessário) e comece a gerenciar seus leads de forma profissional. R$ 59,90/mês.',
};

export default function SubscribePage() {
  return (
    <main className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20">
      <SubscriptionContainer />
    </main>
  );
}
