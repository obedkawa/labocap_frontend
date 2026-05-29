import apiClient from "./client";
import type { PageResponse } from "@/types/api";

export interface Client {
  id: string;
  name: string;
  address?: string;
  contact?: string;
  ifu?: string;
  branchId: string;
}

export interface ClientRequest {
  name: string;
  address?: string;
  contact?: string;
  ifu?: string;
}

export const clientsApi = {
  findAll: (params?: { page?: number; size?: number }) =>
    apiClient.get<PageResponse<Client>>("/clients", { params }),
  create: (data: ClientRequest) => apiClient.post<Client>("/clients", data),
  update: (id: string, data: ClientRequest) =>
    apiClient.put<Client>(`/clients/${id}`, data),
  delete: (id: string) => apiClient.delete(`/clients/${id}`),
};
