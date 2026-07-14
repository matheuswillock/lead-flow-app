import type { AcceptanceForm, AcceptancePageData, AcceptanceResult } from "../context/AcceptanceTypes"

export interface IAcceptanceService {
  getData(): Promise<AcceptancePageData>
  submit(data: AcceptancePageData, form: AcceptanceForm): Promise<AcceptanceResult>
}

