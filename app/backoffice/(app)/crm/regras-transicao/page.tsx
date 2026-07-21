"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BackofficeCrmTransitionRulesProvider } from "./features/context/BackofficeCrmTransitionRulesContext";
import { BackofficeCrmTransitionRulesContainer } from "./features/container/BackofficeCrmTransitionRulesContainer";
import { BackofficeCrmTransitionGatesContainer } from "./features/container/BackofficeCrmTransitionGatesContainer";
import { backofficeCrmTransitionRulesService } from "./features/services/BackofficeCrmTransitionRulesService";

export default function BackofficeCrmTransitionRulesPage() {
  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">Regras de transição — CRM</h1>
        <p className="text-sm text-muted-foreground">
          Configure campos obrigatórios e gates aplicados nas mudanças de status do funil CRM
          backoffice.
        </p>
      </div>

      <Tabs defaultValue="fields">
        <TabsList>
          <TabsTrigger value="fields">Campos obrigatórios</TabsTrigger>
          <TabsTrigger value="gates">Gates de transição</TabsTrigger>
        </TabsList>
        <TabsContent value="fields" className="mt-4">
          <BackofficeCrmTransitionRulesProvider service={backofficeCrmTransitionRulesService}>
            <BackofficeCrmTransitionRulesContainer />
          </BackofficeCrmTransitionRulesProvider>
        </TabsContent>
        <TabsContent value="gates" className="mt-4">
          <BackofficeCrmTransitionGatesContainer />
        </TabsContent>
      </Tabs>
    </div>
  );
}
