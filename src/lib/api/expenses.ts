import apiClient from "./client";
import type { PageResponse } from "@/types/api";

// Méthodes de paiement acceptées par le backend
export type PaymentMethod = "ESPECES" | "CHEQUES" | "MOBILEMONEY" | "VIREMENT";

export interface ExpenseDetail {
  id: string;
  description?: string;
  amount: number;
}

export interface Expense {
  id: string;
  amount: number;
  description?: string;
  supplierId?: string;
  expenseCategorieId?: string;
  cashboxVoucherId?: string;
  paid: number; // 0 = non payé, 1 = payé, 2 = payé + stock maj
  date?: string;
  invoiceNumber?: string;
  payment?: PaymentMethod;
  receipt?: string;
  details?: ExpenseDetail[];
  branchId?: string;
  createdAt?: string;
}

export interface ExpenseRequest {
  amount: number;
  expenseCategorieId: string;
  description?: string;
  supplierId?: string;
  invoiceNumber?: string;
  date?: string;
  payment?: PaymentMethod;
  receipt?: string;
}

export const expensesApi = {
  findAll: (params?: Record<string, unknown>) =>
    apiClient.get<PageResponse<Expense>>("/expenses", { params }),
  findById: (id: string) => apiClient.get<Expense>(`/expenses/${id}`),
  create: (data: ExpenseRequest) => apiClient.post<Expense>("/expenses", data),
  update: (id: string, data: ExpenseRequest) =>
    apiClient.put<Expense>(`/expenses/${id}`, data),
  delete: (id: string) => apiClient.delete(`/expenses/${id}`),
  pay: (id: string) => apiClient.patch<Expense>(`/expenses/${id}/pay`),
};

export interface ExpenseCategory {
  id: string;
  name: string;
  description?: string;
}

export interface ExpenseCategoryRequest {
  name: string;
  description?: string;
}

export const expenseCategoriesApi = {
  findAll: (params?: Record<string, unknown>) =>
    apiClient.get<PageResponse<ExpenseCategory>>("/expense-categories", { params }),
  create: (data: ExpenseCategoryRequest) =>
    apiClient.post<ExpenseCategory>("/expense-categories", data),
  update: (id: string, data: ExpenseCategoryRequest) =>
    apiClient.put<ExpenseCategory>(`/expense-categories/${id}`, data),
  delete: (id: string) => apiClient.delete(`/expense-categories/${id}`),
};
