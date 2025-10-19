import { SubscriptionProvider } from './features/context/SubscriptionContext';
import { SubscriptionContainer } from './features/container/SubscriptionContainer';

export default function SubscriptionPage() {
  return (
    <SubscriptionProvider>
      <div className="container mx-auto p-6 space-y-6">
        <SubscriptionContainer />
      </div>
    </SubscriptionProvider>
  );
}
