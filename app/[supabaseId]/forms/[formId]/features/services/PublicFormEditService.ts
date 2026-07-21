import type { IPublicFormEditService } from "./IPublicFormEditService"

class PublicFormEditService implements IPublicFormEditService {
  noop() {}
}

export const publicFormEditService = new PublicFormEditService()
