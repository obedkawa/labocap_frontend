import apiClient from "./client";
import type { PageResponse } from "@/types/api";

export interface Article {
  id: string;
  name: string;
  code?: string;
  supplierId?: string;
  quantity: number;
  unit?: string;
  purchasePrice: number;
  minimumStock?: number;
  description?: string;
  supplierName?: string;
}

export interface ArticleRequest {
  name: string;
  code?: string;
  supplierId?: string;
  initialQuantity: number;
  purchasePrice: number;
  unit?: string;
  minimumStock?: number;
  description?: string;
}

export interface MovementRequest {
  type: 'IN' | 'OUT' | 'ADJUSTMENT';
  quantity: number;
  notes?: string;
  movementDate?: string; // ISO date YYYY-MM-DD
}

export interface StockMovement {
  id: string;
  articleId: string;
  articleName?: string;
  type: 'IN' | 'OUT' | 'ADJUSTMENT';
  quantity: number;
  notes?: string;
  movementDate: string;
  userId?: string;
  userFullName?: string;
  branchId?: string;
  createdAt?: string;
  article?: { name: string };
}

export interface ArticlesPageResponse {
  articles: {
    content: Article[];
    totalElements: number;
    totalPages: number;
  };
  outOfStockCount: number;
  lowStockCount: number;
}

export const inventoryApi = {
  findAll: (params?: Record<string, unknown>) =>
    apiClient.get<ArticlesPageResponse>("/articles", { params }),
  create: (data: ArticleRequest) => apiClient.post<Article>("/articles", data),
  update: (id: string, data: ArticleRequest) =>
    apiClient.put<Article>(`/articles/${id}`, data),
  delete: (id: string) => apiClient.delete(`/articles/${id}`),
  addMovement: (articleId: string, data: MovementRequest) =>
    apiClient.post<StockMovement>('/movements', { ...data, articleId }),
  getMovements: (id?: string) =>
    apiClient.get<{ content: StockMovement[]; totalElements: number; totalPages: number }>("/movements", {
      params: id ? { articleId: id } : {},
    }),
  // Liste paginée des mouvements (page globale d'historique)
  listMovements: (params?: {
    page?: number;
    size?: number;
    articleId?: string;
  }) =>
    apiClient.get<PageResponse<StockMovement>>("/movements", { params }),
};
