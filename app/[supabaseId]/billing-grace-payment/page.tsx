'use client';

import { BillingGracePaymentProvider } from "./features/context/BillingGracePaymentContext";
import { BillingGracePaymentContainer } from "./features/container/BillingGracePaymentContainer";

export default function BillingGracePaymentPage() {
  return (
    <BillingGracePaymentProvider>
      <BillingGracePaymentContainer />
    </BillingGracePaymentProvider>
  );
}
