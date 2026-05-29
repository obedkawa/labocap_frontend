import apiClient from "./client";

export interface RefundReason {
  id: string;
  label: string;
  branchId?: string;
}

export interface RefundRequestLog {
  operation: string;
  userName?: string;
  createdAt?: string;
}

export interface RefundRequest {
  id: string;
  invoiceId: string;
  refundReasonId?: string;
  montant: number;
  note?: string;
  attachment?: string;
  code?: string;
  status: string;
  logs?: RefundRequestLog[];
  branchId?: string;
  createdAt: string;
}

export interface RefundCreateRequest {
  invoiceId: string;
  refundReasonId: string;
  montant: number;
  note?: string;
}

export const refundReasonsApi = {
  findAll: () => apiClient.get<RefundReason[]>("/refund-reasons"),
};

export const refundsApi = {
  findAll: (params?: Record<string, unknown>) =>
    apiClient.get<{ content: RefundRequest[]; totalElements: number; totalPages: number }>(
      "/refund-requests",
      { params }
    ),

  findById: (id: string) =>
    apiClient.get<RefundRequest>(`/refund-requests/${id}`),

  create: (data: RefundCreateRequest) =>
    apiClient.post<RefundRequest>("/refund-requests", data),

  updateStatus: (id: string, status: string) =>
    apiClient.patch<{ id: string | null; status: string }>(
      `/refund-requests/${id}/status`,
      { status }
    ),

  // UN seul 'p' dans "Aprouvé" — typo héritée du Laravel, maintenue intentionnellement
  approve: (id: string) =>
    apiClient.patch(`/refund-requests/${id}/status`, { status: "Aprouvé" }),

  reject: (id: string) =>
    apiClient.patch(`/refund-requests/${id}/status`, { status: "Rejeté" }),

  delete: (id: string) =>
    apiClient.delete(`/refund-requests/${id}`),
};
