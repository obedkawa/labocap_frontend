import apiClient from "./client";
import type { PageResponse } from "@/types/api";

// ---------------------------------------------------------------------------
// Commandes de prestations (prestation orders)
// Backend: /api/v1/prestation-orders — 1 commande = 1 patient + 1 prestation.
// `total` et le `status` initial ("Nouveau") sont fixés côté serveur.
// ---------------------------------------------------------------------------

export interface PrestationOrder {
  id: string;
  patientId: string;
  patientName: string;
  prestationId: string;
  prestationName: string;
  total: number;
  status: string;
  branchId?: string;
  createdAt?: string;
}

export interface PrestationOrderRequest {
  patientId: string;
  prestationId: string;
  /** Optionnel : ignoré à la création, pris en compte en modification. */
  status?: string;
}

export const prestationOrdersApi = {
  findAll: (params?: Record<string, unknown>) =>
    apiClient.get<PageResponse<PrestationOrder>>("/prestation-orders", {
      params,
    }),
  findById: (id: string) =>
    apiClient.get<PrestationOrder>(`/prestation-orders/${id}`),
  create: (data: PrestationOrderRequest) =>
    apiClient.post<PrestationOrder>("/prestation-orders", data),
  update: (id: string, data: PrestationOrderRequest) =>
    apiClient.put<PrestationOrder>(`/prestation-orders/${id}`, data),
  delete: (id: string) => apiClient.delete(`/prestation-orders/${id}`),
};
