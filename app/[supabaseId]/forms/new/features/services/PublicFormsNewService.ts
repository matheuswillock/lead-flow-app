import type { IPublicFormsNewService } from "./IPublicFormsNewService"

class PublicFormsNewService implements IPublicFormsNewService {
  noop() {}
}

export const publicFormsNewService = new PublicFormsNewService()
