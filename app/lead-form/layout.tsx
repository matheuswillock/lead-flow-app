import type { Metadata } from "next"
import { NO_INDEX_METADATA } from "@/lib/metadata/policies"

export const metadata: Metadata = NO_INDEX_METADATA

export default function LeadFormLayout({ children }: { children: React.ReactNode }) {
  return children
}
