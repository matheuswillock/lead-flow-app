"use client";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { getTotalBeneficiaries } from "@/lib/ageRanges";
import { BeneficiariesCard } from "../components/BeneficiariesCard";
import { HospitalSelectorCard } from "../components/HospitalSelectorCard";
import { PmeSimulatorHeader } from "../components/PmeSimulatorHeader";
import { SimulationResults } from "../components/SimulationResults";
import { usePmeSimulatorContext } from "../context/PmeSimulatorContext";

export function PmeSimulatorContainer() {
  const {
    isCatalogLoading,
    isSimulationLoading,
    isAllowed,
    error,
    catalogs,
    ageRangeCounts,
    serializedAgeRanges,
    selectedHospitalId,
    simulation,
    expandedPlanIds,
    setSerializedAgeRanges,
    selectHospital,
    togglePlan,
  } = usePmeSimulatorContext();

  if (!isAllowed) {
    return (
      <div className="flex min-h-0 flex-1 items-center justify-center p-6">
        <Alert className="max-w-xl border-semantic-warning-border bg-semantic-warning-surface">
          <AlertTitle className="text-semantic-warning">Acesso restrito</AlertTitle>
          <AlertDescription className="text-foreground">
            O Simulador de Planos esta disponível apenas para SDR, Closer e perfis manager.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <main className="flex min-h-0 flex-1 flex-col bg-background">
      <div className="flex w-full flex-1 flex-col gap-5 px-4 py-8 lg:px-6">
        <PmeSimulatorHeader />

        {error ? (
          <Alert variant="destructive">
            <AlertTitle>Erro</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}

        <BeneficiariesCard
          serializedAgeRanges={serializedAgeRanges}
          isLoading={isSimulationLoading}
          onAgeRangesChange={setSerializedAgeRanges}
        />

        <HospitalSelectorCard
          hospitals={catalogs?.hospitals ?? []}
          selectedHospitalId={selectedHospitalId}
          onSelectHospital={selectHospital}
        />

        <SimulationResults
          agesCount={getTotalBeneficiaries(ageRangeCounts)}
          simulation={simulation}
          isLoading={isCatalogLoading || isSimulationLoading}
          expandedPlanIds={expandedPlanIds}
          onTogglePlan={togglePlan}
        />
      </div>
    </main>
  );
}
