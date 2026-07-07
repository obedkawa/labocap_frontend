import apiClient from "./client";
import type { PageResponse } from "@/types/api";

export type InvoicePayment =
  | "ESPECES"
  | "MOBILEMONEY"
  | "CARTEBANCAIRE"
  | "CHEQUES"
  | "VIREMENT"
  | "CREDIT"
  | "AUTRE";

export interface InvoiceDetail {
  id: string;
  labTestId: string;
  testName: string;
  price: number;
  discount: number;
  quantity: number;
  unitPrice: number;
  total: number;
}

export interface Invoice {
  id: string;
  code: string;
  testOrderId?: string;
  testOrderCode?: string;
  patientId: string;
  patientName?: string;
  contratId?: string;
  contratName?: string;
  total: number;
  paid: boolean;
  statusInvoice: number; // 0=vente, 1=avoir
  payment?: InvoicePayment;
  codeMecef?: string;
  dueDate?: string;
  branchId: string;
  createdAt: string;
  details?: InvoiceDetail[];
}

export interface InvoiceRequest {
  testOrderId: string;
  patientId?: string;
  date?: string;
  dueDate?: string;
  details?: Array<{ labTestId: string; quantity?: number; unitPrice?: number }>;
}

export interface MarkPaidRequest {
  payment: InvoicePayment;
}

export interface FinanceStats {
  totalToday?: number;
  totalMonth?: number;
  totalLastMonth?: number;
}

export interface InvoiceSearchResult {
  ca: number;
  avoir: number;
  facture: number;
  encaissement: number;
}

export interface InvoiceMonthlyStats {
  month: number;
  year: number;
  monthName: string;
  facturated: number;
  credits: number;
  turnover: number;
  collections: number;
}

export interface InvoiceSearchParams {
  startDate?: string;
  endDate?: string;
  [key: string]: unknown;
}

export interface InvoiceReport {
  period: string;
  totalSales: number;
  totalCredits: number;
  turnover: number;
  collections: number;
  byContracts: { contractName: string; total: number }[];
}

export interface InvoiceFindAllParams {
  page?: number;
  size?: number;
  search?: string;
  paid?: string | boolean;
  statusInvoice?: number;
  startDate?: string;
  endDate?: string;
  patient?: string;
  [key: string]: unknown;
}

export const invoicesApi = {
  findAll: (params?: InvoiceFindAllParams) =>
    apiClient.get<PageResponse<Invoice>>("/invoices", { params }),

  findById: (id: string) => apiClient.get<Invoice>(`/invoices/${id}`),

  create: (data: InvoiceRequest) => apiClient.post<Invoice>("/invoices", data),

  update: (id: string, data: Partial<InvoiceRequest>) =>
    apiClient.put<Invoice>(`/invoices/${id}`, data),

  delete: (id: string) => apiClient.delete(`/invoices/${id}`),

  markAsPaid: (id: string, data: MarkPaidRequest) =>
    apiClient.patch<Invoice>(`/invoices/${id}/status`, data),

  confirmMecef: (id: string, uid: string) =>
    apiClient.post<Invoice>(`/invoices/${id}/confirm-mecef`, { uid }),

  cancelMecef: (id: string, uid: string) =>
    apiClient.post<Invoice>(`/invoices/${id}/cancel-mecef`, { uid }),

  /** Télécharge le PDF imprimable de la facture (réplique Laravel invoices/print). */
  downloadPdf: (id: string) =>
    apiClient.get(`/invoices/${id}/pdf`, { responseType: "blob" }),

  getFinanceStats: () => apiClient.get<FinanceStats>("/invoices/business"),

  getMonthlyStats: (year?: number) =>
    apiClient.get<InvoiceMonthlyStats[]>("/invoices/monthly-stats", {
      params: year != null ? { year } : undefined,
    }),

  search: (params: InvoiceSearchParams) =>
    apiClient.get<InvoiceSearchResult>("/invoices/search", { params }),

  getTodayStats: () =>
    apiClient.get<{ totalToday: number }>("/invoices/stats/today"),

  getCounts: () =>
    apiClient.get<{ sales: number; credits: number }>("/invoices/counts"),

  getReports: (year?: number, month?: number) =>
    apiClient.get<InvoiceReport>("/invoices/reports", {
      params: { year, month },
    }),
};
