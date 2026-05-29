import apiClient from "./client";
import type { PageResponse } from "@/types/api";

// Statuts possibles — "INACTIF" par défaut, "ACTIF" après activation, "CLOTURE" après clôture
export type ContractStatus = "ACTIF" | "INACTIF" | "CLOTURE";

export interface ContractDetail {
  id: string;
  labTestId?: string;
  labTestName?: string;
  price?: number;
  pourcentage?: number;
  amountRemise?: number;
  amountAfterRemise?: number;
  categoryTestId?: string;
}

export interface Contract {
  id: string;
  name?: string;
  type?: string;
  description?: string;
  hospitalId?: string;
  hospitalName?: string;
  clientId?: string;
  clientName?: string;
  nbrTests: number;
  startDate: string;
  endDate?: string;
  status: ContractStatus;
  invoiceUnique?: boolean;
  isClose?: boolean;
  details?: ContractDetail[];
  branchId?: string;
  createdAt?: string;
}

export interface ContractRequest {
  name?: string;
  type?: string;
  description?: string;
  hospitalId?: string;
  clientId?: string;
  startDate: string;
  endDate?: string;
  nbrTests?: number;
  status?: ContractStatus;
  invoiceUnique?: boolean;
}

export const contractsApi = {
  findAll: (params?: Record<string, unknown>) =>
    apiClient.get<PageResponse<Contract>>("/contracts", { params }),
  findById: (id: string) => apiClient.get<Contract>(`/contracts/${id}`),
  create: (data: ContractRequest) =>
    apiClient.post<Contract>("/contracts", data),
  update: (id: string, data: ContractRequest) =>
    apiClient.put<Contract>(`/contracts/${id}`, data),
  delete: (id: string) => apiClient.delete(`/contracts/${id}`),
  activate: (id: string) =>
    apiClient.patch<Contract>(`/contracts/${id}/status`),
  close: (id: string) =>
    apiClient.post<Contract>(`/contracts/${id}/close`),
  addDetail: (id: string, data: { categoryTestId?: string; discount?: number }) =>
    apiClient.post<ContractDetail>(`/contracts/${id}/details`, data),
  addTestDetail: (id: string, data: { testId: string; amountRemise?: number; amountAfterRemise?: number }) =>
    apiClient.post<ContractDetail>(`/contracts/${id}/details/test`, data),
  deleteDetail: (contractId: string, detailId: string) =>
    apiClient.delete(`/contracts/${contractId}/details/${detailId}`),
};
