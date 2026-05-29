import apiClient from "./client";
import type { PageResponse } from "@/types/api";

export interface Doctor {
  id: string;
  name: string;
  email?: string;
  telephone?: string;
  role?: string;
  commission?: number;
  branchId: string;
  createdAt?: string;
}

export interface DoctorRequest {
  name: string;
  email?: string;
  telephone?: string;
  commission?: number;
  role?: string;
}

export const doctorsApi = {
  findAll: (params?: { page?: number; size?: number; search?: string }) =>
    apiClient.get<PageResponse<Doctor>>("/doctors", { params }),
  search: (q: string) =>
    apiClient.get<Doctor[]>("/doctors/search", { params: { q } }),
  create: (data: DoctorRequest) => apiClient.post<Doctor>("/doctors", data),
  update: (id: string, data: DoctorRequest) =>
    apiClient.put<Doctor>(`/doctors/${id}`, data),
  delete: (id: string) => apiClient.delete(`/doctors/${id}`),
};
