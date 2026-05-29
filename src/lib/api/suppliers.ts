import apiClient from "./client";
import type { PageResponse } from "@/types/api";

export interface Supplier {
  id: string;
  name: string;
  phone?: string;
  email?: string;
  address?: string;
  information?: string;
  categoryId?: string;
  categoryName?: string;
}

export interface SupplierRequest {
  name: string;
  phone?: string;
  email?: string;
  address?: string;
  information?: string;
  categoryId?: string;
}

export interface SupplierCategory {
  id: string;
  name: string;
  description?: string;
}

export interface SupplierCategoryRequest {
  name: string;
  description?: string;
}

export const supplierCategoriesApi = {
  findAll: () =>
    apiClient.get<SupplierCategory[]>("/supplier-categories"),
  create: (data: SupplierCategoryRequest) =>
    apiClient.post<SupplierCategory>("/supplier-categories", data),
  update: (id: string, data: SupplierCategoryRequest) =>
    apiClient.put<SupplierCategory>(`/supplier-categories/${id}`, data),
  delete: (id: string) => apiClient.delete(`/supplier-categories/${id}`),
};

export const suppliersApi = {
  findAll: (params?: Record<string, unknown>) =>
    apiClient.get<PageResponse<Supplier>>("/suppliers", { params }),
  create: (data: SupplierRequest) =>
    apiClient.post<Supplier>("/suppliers", data),
  update: (id: string, data: SupplierRequest) =>
    apiClient.put<Supplier>(`/suppliers/${id}`, data),
  delete: (id: string) => apiClient.delete(`/suppliers/${id}`),
};
