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

/** Fichier joint à une consultation (dépendant du type de consultation). */
export interface ConsultationFile {
  id: string;
  typeFileLabel?: string;
  path: string;
  comment?: string;
  createdAt: string;
}

/** URL publique d'un fichier de consultation (servi par /files/{path}). */
export function getConsultationFileUrl(path: string): string {
  const base = (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080/api/v1").replace(/\/$/, "");
  return `${base}/files/${path}`;
}

export const consultationsApi = {
  findAll: (params?: Record<string, unknown>) =>
    apiClient.get<PageResponse<Consultation>>("/consultations", { params }),
  findById: (id: string) =>
    apiClient.get<Consultation>(`/consultations/${id}`),
  create: (data: ConsultationRequest) =>
    apiClient.post<Consultation>("/consultations", data),

  /**
   * Met à jour une consultation. Envoyé en multipart : la partie JSON `data`
   * (contrat backend `@RequestPart("data")`) + des fichiers optionnels `typeFile`.
   */
  update: (id: string, data: Partial<ConsultationRequest>, files?: File[]) => {
    const fd = new FormData();
    fd.append("data", new Blob([JSON.stringify(data)], { type: "application/json" }));
    (files ?? []).forEach((f) => fd.append("typeFile", f));
    return apiClient.put<Consultation>(`/consultations/${id}`, fd, {
      headers: { "Content-Type": "multipart/form-data" },
    });
  },

  /** Liste les fichiers joints à une consultation. */
  getFiles: (id: string) =>
    apiClient.get<ConsultationFile[]>(`/consultations/${id}/files`),

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
