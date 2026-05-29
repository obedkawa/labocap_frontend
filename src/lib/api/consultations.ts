import apiClient from "./client";
import type { PageResponse } from "@/types/api";

export interface Consultation {
  id: string;
  patientId: string;
  doctorId?: string;
  typeConsultationId?: string;
  date: string;
  motif?: string;
  notes?: string;
  amount?: number;
  status?: string;
  patient?: { firstname: string; lastname: string; code: string };
  doctor?: { firstname: string; lastname: string };
  typeConsultation?: { name: string };
}

export interface ConsultationRequest {
  patientId: string;
  doctorId?: string;
  typeConsultationId?: string;
  date: string;
  motif?: string;
  notes?: string;
  amount?: number;
}

export const consultationsApi = {
  findAll: (params?: Record<string, unknown>) =>
    apiClient.get<PageResponse<Consultation>>("/consultations", { params }),
  findById: (id: string) =>
    apiClient.get<Consultation>(`/consultations/${id}`),
  create: (data: ConsultationRequest) =>
    apiClient.post<Consultation>("/consultations", data),
  update: (id: string, data: Partial<ConsultationRequest>) =>
    apiClient.put<Consultation>(`/consultations/${id}`, data),
  delete: (id: string) => apiClient.delete(`/consultations/${id}`),
};

// ---------------------------------------------------------------------------
// Types de consultation
// ---------------------------------------------------------------------------

export interface TypeConsultation {
  id: string;
  name: string;
  branchId?: string;
  createdAt?: string;
}

export interface TypeConsultationRequest {
  name: string;
}

export const typeConsultationsApi = {
  findAll: (params?: Record<string, unknown>) =>
    apiClient.get<PageResponse<TypeConsultation>>("/type-consultations", { params }),
  create: (data: TypeConsultationRequest) =>
    apiClient.post<TypeConsultation>("/type-consultations", data),
  update: (id: string, data: TypeConsultationRequest) =>
    apiClient.put<TypeConsultation>(`/type-consultations/${id}`, data),
  delete: (id: string) => apiClient.delete(`/type-consultations/${id}`),
};
