import { SelfCheckoutSkeleton } from "@/app/checkout/features/components/SelfCheckoutSkeleton";

export default function Loading() {
  return (
    <main className="mx-auto w-full max-w-[1120px] px-6 py-8">
      <SelfCheckoutSkeleton />
    </main>
  );
}
