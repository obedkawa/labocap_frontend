import apiClient from "./client";
import type { PageResponse } from "@/types/api";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SettingInvoice {
  id: string;
  ifu?: string;
  token?: string;
  status: boolean;
  branchId?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface SettingInvoiceRequest {
  ifu: string;
  token: string;
  status?: boolean;
}

// ---------------------------------------------------------------------------
// API
// ---------------------------------------------------------------------------

export const settingInvoicesApi = {
  findAll: (params?: { page?: number; size?: number }) =>
    apiClient.get<PageResponse<SettingInvoice>>("/setting-invoices", { params }),

  findById: (id: string) =>
    apiClient.get<SettingInvoice>(`/setting-invoices/${id}`),

  update: (id: string, data: SettingInvoiceRequest) =>
    apiClient.put<SettingInvoice>(`/setting-invoices/${id}`, data),
};
