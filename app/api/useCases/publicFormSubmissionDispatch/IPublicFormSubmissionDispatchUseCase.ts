import type { Output } from "@/lib/output"

export interface IPublicFormSubmissionDispatchUseCase {
  execute(limit?: number): Promise<Output>
}
