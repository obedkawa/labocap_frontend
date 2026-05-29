import apiClient from "./client";
import type { PageResponse } from "@/types/api";

export interface TitleReport {
  id: string;
  name: string;
  isDefault: boolean;
  branchId?: string;
  createdAt?: string;
}

export interface TitleReportRequest {
  name: string;
  isDefault?: boolean;
}

export const titleReportsApi = {
  findAll: (params?: { page?: number; size?: number }) =>
    apiClient.get<PageResponse<TitleReport>>("/title-reports", { params }),

  findById: (id: string) =>
    apiClient.get<TitleReport>(`/title-reports/${id}`),

  getDefault: () => apiClient.get<TitleReport>("/title-reports/default"),

  create: (data: TitleReportRequest) =>
    apiClient.post<TitleReport>("/title-reports", data),

  update: (id: string, data: TitleReportRequest) =>
    apiClient.put<TitleReport>(`/title-reports/${id}`, data),

  delete: (id: string) =>
    apiClient.delete(`/title-reports/${id}`),
};
