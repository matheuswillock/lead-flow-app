// app/subscribe/page.tsx
import { Metadata } from 'next';
import { SubscriptionContainer } from './features/container/SubscriptionContainer';
import {
  SHARE_IMAGE_ALT,
  SHARE_IMAGE_HEIGHT,
  SHARE_IMAGE_PATH,
  SHARE_IMAGE_WIDTH,
  SHARE_SITE_NAME,
} from '@/lib/metadata/share';

const subscribeTitle = 'Assinar Corretor Studio | Plataforma de Gestão de Leads';
const subscribeDescription = 'Assine o Corretor Studio (login necessário) e comece a gerenciar seus leads de forma profissional. R$ 59,90/mês.';

export const metadata: Metadata = {
  title: subscribeTitle,
  description: subscribeDescription,
  openGraph: {
    title: subscribeTitle,
    description: subscribeDescription,
    url: '/subscribe',
    siteName: SHARE_SITE_NAME,
    locale: 'pt_BR',
    type: 'website',
    images: [
      {
        url: SHARE_IMAGE_PATH,
        width: SHARE_IMAGE_WIDTH,
        height: SHARE_IMAGE_HEIGHT,
        alt: SHARE_IMAGE_ALT,
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: subscribeTitle,
    description: subscribeDescription,
    images: [SHARE_IMAGE_PATH],
  },
};

export default function SubscribePage() {
  return (
    <main className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20">
      <SubscriptionContainer />
    </main>
  );
}
