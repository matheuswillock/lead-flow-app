export interface CnaeItem {
  code: string
  name: string
}

export interface IBackofficeCnaeRepository {
  search(q?: string): Promise<CnaeItem[]>
}
