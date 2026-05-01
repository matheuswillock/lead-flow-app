import type { ExpiredAdhesionViewState } from "../context/ExpiredAdhesionTypes"
import type { IExpiredAdhesionService } from "./IExpiredAdhesionService"

export class ExpiredAdhesionService implements IExpiredAdhesionService {
  getViewState(): ExpiredAdhesionViewState {
    return {
      title: "Link de adesão indisponível",
      description:
        "Este link expirou, foi cancelado ou não está mais disponível para pagamento.",
    }
  }
}
