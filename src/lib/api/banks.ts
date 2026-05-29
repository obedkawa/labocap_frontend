import apiClient from "./client";
import type { PageResponse } from "@/types/api";

export interface Bank {
  id: string;
  name: string;
  accountNumber?: string;
  description?: string;
  branchId?: string;
  createdAt?: string;
}

export interface BankRequest {
  name: string;
  accountNumber?: string;
  description?: string;
}

export const banksApi = {
  findAll: (params?: Record<string, unknown>) =>
    apiClient.get<PageResponse<Bank>>("/banks", { params }),
  create: (data: BankRequest) => apiClient.post<Bank>("/banks", data),
  update: (id: string, data: BankRequest) =>
    apiClient.put<Bank>(`/banks/${id}`, data),
  delete: (id: string) => apiClient.delete(`/banks/${id}`),
};
