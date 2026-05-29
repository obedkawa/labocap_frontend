import apiClient from "./client";
import type { PageResponse } from "@/types/api";

// ---------------------------------------------------------------------------
// Interfaces — Cashbox (caisse principale)
// ---------------------------------------------------------------------------

export interface CashboxResponseDto {
  id: string;
  name: string;
  type: string;
  balance: number;
  branchId: string;
  createdAt: string;
}

export interface CashboxCreateDto {
  name: string;
  type: string;
  branchId: string;
}

// ---------------------------------------------------------------------------
// Interfaces — CashboxDaily (session journalière)
// ---------------------------------------------------------------------------

export interface CashboxDailyResponseDto {
  id: string;
  cashboxId: string;
  openingBalance: number;
  closingBalance: number | null;
  date: string;
  status: number;
  code: string;
  cashCalculated: number | null;
  cashConfirmation: number | null;
  cashEcart: number | null;
  mobileMoneyCalculated: number | null;
  moneyMoneyConfirmation: number | null;
  mobileMoneyEcart: number | null;
  chequeCalculated: number | null;
  chequeConfirmation: number | null;
  chequeEcart: number | null;
  virementCalculated: number | null;
  virementConfirmation: number | null;
  virementEcart: number | null;
  totalCalculated: number | null;
  totalConfirmation: number | null;
  totalEcart: number | null;
  branchId: string;
  createdAt: string;
}

export interface CashboxDailyOpenDto {
  soldeOuverture: number;
  cashboxId: string;
}

export interface CashboxDailyCloseDto {
  closingBalance: number;
  cashCalculated: number;
  cashConfirmation: number;
  cashEcart: number;
  mobileMoneyCalculated: number;
  moneyMoneyConfirmation: number;
  mobileMoneyEcart: number;
  chequeCalculated: number;
  chequeConfirmation: number;
  chequeEcart: number;
  virementCalculated: number;
  virementConfirmation: number;
  virementEcart: number;
  totalCalculated: number;
  totalConfirmation: number;
  totalEcart: number;
}

// ---------------------------------------------------------------------------
// Interfaces — CashboxOperation
// ---------------------------------------------------------------------------

export interface CashboxOperationResponseDto {
  id: string;
  cashboxId: string;
  amount: number;
  type: string;
  description: string | null;
  operationDate: string;
  branchId: string;
  createdAt: string;
}

export interface CashboxOperationCreateDto {
  cashboxId: string;
  amount: number;
  type: string;
  description?: string;
  operationDate: string;
}

export interface CashboxOperationParams {
  cashboxId?: string;
  type?: string;
  date?: string;
  page?: number;
  size?: number;
}

// ---------------------------------------------------------------------------
// Interfaces — CashboxVoucher (bon / ticket)
// ---------------------------------------------------------------------------

export interface CashboxVoucherDetail {
  id: string;
  itemName: string;
  quantity: number;
  unitPrice: number;
  lineAmount: number;
}

export interface CashboxVoucherResponseDto {
  id: string;
  cashboxId: string;
  code: string;
  amount: number;
  description: string | null;
  status: string;
  supplierId: string | null;
  expenseCategoryId: string | null;
  ticketFile: string | null;
  details: CashboxVoucherDetail[];
  branchId: string;
  createdAt: string;
}

export interface CashboxVoucherCreateDto {
  description: string;
  supplierId?: string;
  expenseCategoryId?: string;
  cashboxId?: string;
}

// ---------------------------------------------------------------------------
// API
// ---------------------------------------------------------------------------

export const cashboxApi = {
  // ---- Caisses ----
  getCashboxes: () =>
    apiClient.get<PageResponse<CashboxResponseDto>>("/cashboxes"),

  getCashbox: (id: string) =>
    apiClient.get<CashboxResponseDto>(`/cashboxes/${id}`),

  createCashbox: (data: CashboxCreateDto) =>
    apiClient.post<CashboxResponseDto>("/cashboxes", data),

  updateCashbox: (id: string, data: Partial<CashboxCreateDto>) =>
    apiClient.put<CashboxResponseDto>(`/cashboxes/${id}`, data),

  // ---- Sessions journalières (dailies) ----
  getDailies: (params?: Record<string, unknown>) =>
    apiClient.get<PageResponse<CashboxDailyResponseDto>>("/cashbox-dailies", {
      params,
    }),

  getDaily: (id: string) =>
    apiClient.get<CashboxDailyResponseDto>(`/cashbox-dailies/${id}`),

  getDailiesSummary: () =>
    apiClient.get<Record<string, unknown>>("/cashbox-dailies/summary"),

  openDaily: (data: CashboxDailyOpenDto) =>
    apiClient.post<CashboxDailyResponseDto>("/cashbox-dailies", data),

  closeDaily: (id: string, data: CashboxDailyCloseDto) =>
    apiClient.put<CashboxDailyResponseDto>(`/cashbox-dailies/${id}`, data),

  deleteDaily: (id: string) =>
    apiClient.delete(`/cashbox-dailies/${id}`),

  // ---- Opérations ----
  getOperations: (params?: CashboxOperationParams) =>
    apiClient.get<PageResponse<CashboxOperationResponseDto>>(
      "/cashbox-operations",
      { params }
    ),

  addOperation: (data: CashboxOperationCreateDto) =>
    apiClient.post<CashboxOperationResponseDto>("/cashbox-operations", data),

  // ---- Bons / Vouchers ----
  getVouchers: (params?: Record<string, unknown>) =>
    apiClient.get<PageResponse<CashboxVoucherResponseDto>>(
      "/cashbox-tickets",
      { params }
    ),

  addVoucher: (data: CashboxVoucherCreateDto) =>
    apiClient.post<CashboxVoucherResponseDto>("/cashbox-tickets", data),
};
