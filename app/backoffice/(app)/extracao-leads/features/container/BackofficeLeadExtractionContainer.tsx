"use client"

import { FilterSidebar } from "../components/FilterSidebar"
import { ResultsList } from "../components/ResultsList"

export function BackofficeLeadExtractionContainer() {
  return (
    <div className="flex h-full gap-4 overflow-hidden p-5">
      <FilterSidebar />
      <ResultsList />
    </div>
  )
}
