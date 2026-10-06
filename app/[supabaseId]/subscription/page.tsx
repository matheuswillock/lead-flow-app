import { SubscriptionProvider } from './features/context/SubscriptionContext';
import { SubscriptionContainer } from './features/container/SubscriptionContainer';

export default function SubscriptionPage() {
  return (
    <SubscriptionProvider>
      <div className="container mx-auto flex flex-col gap-6 p-6">
        <SubscriptionContainer />
      </div>
    </SubscriptionProvider>
  );
}
