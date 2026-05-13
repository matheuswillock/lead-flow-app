"use client";

import { PmeSimulatorProvider } from "./features/context/PmeSimulatorContext";
import { PmeSimulatorContainer } from "./features/container/PmeSimulatorContainer";

export default function PmeSimulatorPage() {
  return (
    <PmeSimulatorProvider>
      <PmeSimulatorContainer />
    </PmeSimulatorProvider>
  );
}

