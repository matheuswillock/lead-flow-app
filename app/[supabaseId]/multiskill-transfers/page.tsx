'use client';

import { MultiskillTransfersProvider } from "./features/context/MultiskillTransfersContext";
import { MultiskillTransfersContainer } from "./features/container/MultiskillTransfersContainer";

export default function MultiskillTransfersPage() {
  return (
    <MultiskillTransfersProvider>
      <MultiskillTransfersContainer />
    </MultiskillTransfersProvider>
  );
}
