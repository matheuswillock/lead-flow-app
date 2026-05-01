import type { ExpiredAdhesionViewState } from "../context/ExpiredAdhesionTypes"

export interface IExpiredAdhesionService {
  getViewState(): ExpiredAdhesionViewState
}
