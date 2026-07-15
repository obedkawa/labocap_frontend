import { toast } from "sonner";
import apiClient from "@/lib/api/client";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface Doc {
  id: string;
  title: string;
  attachment: string;
  isCurrentVersion?: boolean;
  fileSize?: number;
  documentationCategoryId?: string;
  userId?: string;
  roleId?: string;
  branchId?: string;
  createdAt: string;
}

export interface DocVersion {
  id: string;
  docId: string;
  version: number;
  title?: string;
  attachment: string;
  fileSize?: number;
  userId?: string;
  createdAt: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

export function getDocFileUrl(attachment: string): string {
  const base = (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080/api/v1").replace(/\/$/, "");
  return `${base}/files/${attachment}`;
}

/**
 * Télécharge un fichier joint en passant par apiClient (cookies + refresh token
 * via l'intercepteur), plutôt qu'un `<a href>` direct qui contournerait le
 * rafraîchissement d'authentification (le endpoint /files/** exige un JWT valide).
 */
export async function downloadDocFile(
  attachment: string,
  filename?: string
): Promise<void> {
  try {
    const response = await apiClient.get(`/files/${attachment}`, {
      responseType: "blob",
    });
    const blob = response.data as Blob;
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename || attachment.split("/").pop() || "document";
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.URL.revokeObjectURL(url);
  } catch {
    toast.error("Échec du téléchargement du fichier");
  }
}

export function formatFileSize(bytes?: number): string {
  if (!bytes) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} Ko`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
}

// ---------------------------------------------------------------------------
// API
// ---------------------------------------------------------------------------

export const docsApi = {
  findAll: (params?: Record<string, unknown>) =>
    apiClient.get<{ content: Doc[]; totalElements: number; totalPages: number }>(
      "/docs",
      { params }
    ),

  findById: (id: string) => apiClient.get<Doc>(`/docs/${id}`),

  create: (title: string, file: File, documentationCategoryId?: string) => {
    const fd = new FormData();
    fd.append("title", title);
    fd.append("file", file);
    if (documentationCategoryId) fd.append("documentationCategoryId", documentationCategoryId);
    return apiClient.post<Doc>("/docs", fd, {
      headers: { "Content-Type": "multipart/form-data" },
    });
  },

  addVersion: (id: string, file: File, title?: string) => {
    const fd = new FormData();
    fd.append("file", file);
    if (title) fd.append("title", title);
    return apiClient.post<DocVersion>(`/docs/${id}/versions`, fd, {
      headers: { "Content-Type": "multipart/form-data" },
    });
  },

  getVersions: (id: string) => apiClient.get<DocVersion[]>(`/docs/${id}/versions`),

  delete: (id: string) => apiClient.delete(`/docs/${id}`),

  // --- GED avancée ---

  /** Partage un document avec un rôle (notifie par email les utilisateurs du rôle). */
  share: (id: string, roleId: string) =>
    apiClient.post<Doc>(`/docs/${id}/share`, { roleId }),

  /** Documents partagés avec l'utilisateur courant (via ses rôles). */
  sharedWithMe: (params?: Record<string, unknown>) =>
    apiClient.get<{ content: Doc[]; totalElements: number; totalPages: number }>(
      "/docs/shared-with-me",
      { params }
    ),

  /** Documents les plus récents. */
  recent: (limit = 5) =>
    apiClient.get<Doc[]>("/docs/recent", { params: { limit } }),
};

// ---------------------------------------------------------------------------
// Documentation Categories
// ---------------------------------------------------------------------------

export interface DocumentationCategory {
  id: string;
  name: string;
  branchId?: string;
}

export interface DocumentationCategoryRequest {
  name: string;
}

export const documentationCategoriesApi = {
  findAll: (params?: Record<string, unknown>) =>
    apiClient.get<DocumentationCategory[]>("/documentation-categories", { params }),
  create: (data: DocumentationCategoryRequest) =>
    apiClient.post<DocumentationCategory>("/documentation-categories", data),
  update: (id: string, data: DocumentationCategoryRequest) =>
    apiClient.put<DocumentationCategory>(`/documentation-categories/${id}`, data),
  delete: (id: string) => apiClient.delete(`/documentation-categories/${id}`),
};
