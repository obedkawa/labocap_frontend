import apiClient from "./client";
import type { PageResponse } from "@/types/api";

export interface Prestation {
  id: string;
  name: string;
  description?: string;
  price: number;
  categoryId?: string;
  category?: { name: string };
}

export interface PrestationRequest {
  name: string;
  description?: string;
  price: number;
  categoryId?: string;
}

export const prestationsApi = {
  findAll: (params?: Record<string, unknown>) =>
    apiClient.get<PageResponse<Prestation>>("/prestations", { params }),
  create: (data: PrestationRequest) =>
    apiClient.post<Prestation>("/prestations", data),
  update: (id: string, data: PrestationRequest) =>
    apiClient.put<Prestation>(`/prestations/${id}`, data),
  delete: (id: string) => apiClient.delete(`/prestations/${id}`),
};

// ---------------------------------------------------------------------------
// Category Prestations
// ---------------------------------------------------------------------------

export interface CategoryPrestation {
  id: string;
  name: string;
  slug?: string;
  branchId?: string;
  createdAt?: string;
}

export interface CategoryPrestationRequest {
  name: string;
}

export const categoryPrestationsApi = {
  findAll: (params?: Record<string, unknown>) =>
    apiClient.get<PageResponse<CategoryPrestation>>("/category-prestations", { params }),
  create: (data: CategoryPrestationRequest) =>
    apiClient.post<CategoryPrestation>("/category-prestations", data),
  update: (id: string, data: CategoryPrestationRequest) =>
    apiClient.put<CategoryPrestation>(`/category-prestations/${id}`, data),
  delete: (id: string) => apiClient.delete(`/category-prestations/${id}`),
};
