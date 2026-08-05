"use client"

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { FilterSidebar } from "../components/FilterSidebar"
import { ResultsList } from "../components/ResultsList"
import { SocioFilterSidebar } from "../components/SocioFilterSidebar"
import { SocioResultsList } from "../components/SocioResultsList"
import { useBackofficeLeadExtraction } from "../context/BackofficeLeadExtractionContext"

export function BackofficeLeadExtractionContainer() {
  const { activeTab, setActiveTab } = useBackofficeLeadExtraction()

  return (
    <Tabs
      value={activeTab}
      onValueChange={(v) => setActiveTab(v as "empresas" | "socios")}
      className="flex h-full flex-col overflow-hidden p-5 gap-4"
    >
      <TabsList className="w-fit">
        <TabsTrigger value="empresas">Empresas</TabsTrigger>
        <TabsTrigger value="socios">Sócios</TabsTrigger>
      </TabsList>
      <TabsContent value="empresas" className="flex flex-1 gap-4 overflow-hidden m-0">
        <FilterSidebar />
        <ResultsList />
      </TabsContent>
      <TabsContent value="socios" className="flex flex-1 gap-4 overflow-hidden m-0">
        <SocioFilterSidebar />
        <SocioResultsList />
      </TabsContent>
    </Tabs>
  )
}
