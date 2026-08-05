import type {
  IBackofficeUsersService,
  BackofficeUserItem,
  CreateUserFormData,
  UpdateUserFormData,
} from "./IBackofficeUsersService"
import { API_CLIENT_BASE } from "@/lib/route-map";

export class BackofficeUsersService implements IBackofficeUsersService {
  async list(): Promise<BackofficeUserItem[]> {
    const res = await fetch(`${API_CLIENT_BASE}/backoffice/users`, { cache: "no-store" })
    const data = await res.json()
    if (!data.isValid) throw new Error(data.errorMessages?.[0] ?? "Erro ao buscar usuários")
    return data.result ?? []
  }

  async create(body: CreateUserFormData) {
    const res = await fetch(`${API_CLIENT_BASE}/backoffice/users`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })
    return res.json()
  }

  async update(id: string, body: UpdateUserFormData) {
    const res = await fetch(`${API_CLIENT_BASE}/backoffice/users/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })
    return res.json()
  }

  async delete(id: string) {
    const res = await fetch(`${API_CLIENT_BASE}/backoffice/users/${id}`, {
      method: "DELETE",
    })
    return res.json()
  }
}
