import apiClient from "./client";
import type { PageResponse } from "@/types/api";

export interface Hospital {
  id: string;
  name: string;
  email?: string;
  telephone?: string;
  adresse?: string;
  commission?: number;
  branchId: string;
  createdAt?: string;
}

export interface HospitalRequest {
  name: string;
  telephone?: string;
  email?: string;
  adresse?: string;
  commission?: number;
}

export const hospitalsApi = {
  findAll: (params?: { page?: number; size?: number; search?: string }) =>
    apiClient.get<PageResponse<Hospital>>("/hospitals", { params }),
  search: (q: string) =>
    apiClient.get<Hospital[]>("/hospitals/search", { params: { q } }),
  create: (data: HospitalRequest) =>
    apiClient.post<Hospital>("/hospitals", data),
  update: (id: string, data: HospitalRequest) =>
    apiClient.put<Hospital>(`/hospitals/${id}`, data),
  delete: (id: string) => apiClient.delete(`/hospitals/${id}`),
};
