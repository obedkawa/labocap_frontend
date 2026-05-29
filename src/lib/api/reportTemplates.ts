import apiClient from "./client";
import type { PageResponse } from "@/types/api";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ReportTemplate {
  id: string;
  /** Titre du template (champ Laravel principal). */
  title?: string;
  description?: string;
  detail?: string;
  /** Contenu HTML/texte du template (champ Laravel principal). */
  content?: string;
  // Champs refonte (legacy)
  name?: string;
  header?: string;
  footer?: string;
  logoPath?: string;
  branchId?: string;
  createdAt?: string;
}

export interface ReportTemplateRequest {
  title: string;
  description?: string;
  detail?: string;
  content?: string;
  name?: string;
  header?: string;
  footer?: string;
  logoPath?: string;
}

// ---------------------------------------------------------------------------
// API
// ---------------------------------------------------------------------------

export const reportTemplatesApi = {
  findAll: (params?: { page?: number; size?: number }) =>
    apiClient.get<PageResponse<ReportTemplate>>("/report-templates", {
      params,
    }),

  findById: (id: string) =>
    apiClient.get<ReportTemplate>(`/report-templates/${id}`),

  create: (data: ReportTemplateRequest) =>
    apiClient.post<ReportTemplate>("/report-templates", data),

  update: (id: string, data: ReportTemplateRequest) =>
    apiClient.put<ReportTemplate>(`/report-templates/${id}`, data),

  delete: (id: string) => apiClient.delete(`/report-templates/${id}`),
};
