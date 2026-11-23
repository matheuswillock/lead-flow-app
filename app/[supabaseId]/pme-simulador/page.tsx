import { PlanSimulatorProvider } from "./features/context/PlanSimulatorContext";
import { PlanSimulatorContainer } from "./features/container/PlanSimulatorContainer";

export default function PlanSimulatorPage() {
  return (
    <PlanSimulatorProvider>
      <PlanSimulatorContainer />
    </PlanSimulatorProvider>
  );
}
