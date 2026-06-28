"use client";

import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BackofficeStickyHelpButton } from "@/app/backoffice/components/BackofficeStickyHelpButton";
import { BackofficeLeadStatusTransitionRulesProvider } from "./features/context/BackofficeLeadStatusTransitionRulesContext";
import { BackofficeLeadStatusTransitionRulesContainer } from "./features/container/BackofficeLeadStatusTransitionRulesContainer";
import { BackofficeLeadStatusTransitionGatesContainer } from "./features/container/BackofficeLeadStatusTransitionGatesContainer";
import { BackofficeTransitionRulesHelpDialog } from "./features/components/BackofficeTransitionRulesHelpDialog";
import { backofficeLeadStatusTransitionRulesService } from "./features/services/BackofficeLeadStatusTransitionRulesService";

export default function BackofficeLeadStatusTransitionRulesPage() {
  const [helpOpen, setHelpOpen] = useState(false);

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">Regras de transição de status</h1>
        <p className="text-sm text-muted-foreground">
          Configure campos obrigatórios e gates globais aplicados nas mudanças de status do CRM.
        </p>
      </div>

      <Tabs defaultValue="fields">
        <TabsList>
          <TabsTrigger value="fields">Campos obrigatórios</TabsTrigger>
          <TabsTrigger value="gates">Gates de transição</TabsTrigger>
        </TabsList>
        <TabsContent value="fields" className="mt-4">
          <BackofficeLeadStatusTransitionRulesProvider service={backofficeLeadStatusTransitionRulesService}>
            <BackofficeLeadStatusTransitionRulesContainer />
          </BackofficeLeadStatusTransitionRulesProvider>
        </TabsContent>
        <TabsContent value="gates" className="mt-4">
          <BackofficeLeadStatusTransitionGatesContainer />
        </TabsContent>
      </Tabs>

      <BackofficeStickyHelpButton onClick={() => setHelpOpen(true)} />
      <BackofficeTransitionRulesHelpDialog open={helpOpen} onOpenChange={setHelpOpen} />
    </div>
  );
}
