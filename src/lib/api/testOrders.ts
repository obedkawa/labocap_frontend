import apiClient from "./client";
import type { PageResponse } from "@/types/api";

export interface DetailTestOrderDto {
  id: string;
  labTestId: string;
  labTestName: string;
  testName: string;
  price: number;
  discount: number;
  total: number;
}

// Alias pour la compatibilité avec les pages existantes
export type TestOrderDetail = DetailTestOrderDto;

// ImageDto retourné par le backend (List<ImageDto>)
export interface ImageDto {
  index: number;
  filename: string;
  url: string;
}

// DiscountDto retourné par le backend
export interface DiscountDto {
  basePrice: number;
  contractPrice: number | null;
  discount: number;
  priceAfterDiscount: number;
}

export interface TestOrder {
  id: string;
  code: string;
  status: string; // TestOrderStatus enum (string)
  prelevementDate?: string;
  referenceHopital?: string;
  isUrgent: boolean;
  subtotal?: number;
  discount?: number;
  total: number;
  patientId: string;
  patientFirstname: string;
  patientLastname: string;
  doctorId?: string;
  doctorName?: string;
  hospitalId?: string;
  hospitalName?: string;
  contratId?: string;
  contratName?: string; // optionnel — sera ajouté côté backend ultérieurement
  typeOrderId?: string;
  typeOrderTitle?: string;
  attribuateDoctorId?: string;
  assignedToUserId?: string;
  option?: boolean;
  details: DetailTestOrderDto[];
  branchId: string;
  createdAt: string;
  reportId?: string;
  reportStatus?: string;       // "DRAFT" | "VALIDATED" | "DELIVERED" | "PENDING_REVIEW"
  reportIsDelivered?: boolean;
  invoiceId?: string;
  archive?: string;            // chemin fichier joint
}

export interface MySpaceStats {
  totalAssigned: number;
  totalPending: number;
  totalValidated: number;
  totalUrgent: number;
  totalLate: number;
}

// Dto pour un détail envoyé dans le body de create/update
export interface DetailTestOrderRequestDto {
  labTestId: string;
  price: number;
  discount: number;
}

export interface TestOrderRequest {
  patientId: string;
  prelevementDate: string;
  typeOrderId?: string;
  doctorId?: string;
  hospitalId?: string;
  contratId?: string;
  referenceHopital?: string;
  examenReferenceInput?: string;
  isUrgent?: boolean;
  option?: boolean;
  assignedToUserId?: string;
  details?: DetailTestOrderRequestDto[];
}

export const testOrdersApi = {
  findAll: (params?: {
    page?: number;
    size?: number;
    status?: string;
    typeOrderId?: string;
    isUrgent?: boolean;
    patientId?: string;
    doctorId?: string;
    attribuateDoctorId?: string;
    contratId?: string;
    assignedToMe?: boolean;
    search?: string;
    from?: string;
    to?: string;
  }) => apiClient.get<PageResponse<TestOrder>>("/test-orders", { params }),

  findAllImmuno: (params?: {
    page?: number;
    size?: number;
    status?: string;
    isUrgent?: boolean;
    patientId?: string;
    doctorId?: string;
    attribuateDoctorId?: string;
    contratId?: string;
    search?: string;
    from?: string;
    to?: string;
  }) => apiClient.get<PageResponse<TestOrder>>("/test-orders/immuno", { params }),

  countImmunoPending: () =>
    apiClient.get<{ count: number }>("/test-orders/immuno/count-pending"),

  findById: (id: string) => apiClient.get<TestOrder>(`/test-orders/${id}`),

  create: (data: TestOrderRequest) =>
    apiClient.post<TestOrder>("/test-orders", data),

  update: (id: string, data: TestOrderRequest) =>
    apiClient.put<TestOrder>(`/test-orders/${id}`, data),

  delete: (id: string) => apiClient.delete(`/test-orders/${id}`),

  // status envoyé en query param (@RequestParam côté backend)
  updateStatus: (testOrderId: string, status?: string) =>
    apiClient.patch(`/test-orders/${testOrderId}/status`, null, {
      params: status ? { status } : undefined,
    }),

  addImages: (testOrderId: string, files: FileList) => {
    const fd = new FormData();
    // @RequestParam("files_name") côté backend
    Array.from(files).forEach((f) => fd.append("files_name", f));
    return apiClient.post(`/test-orders/${testOrderId}/images`, fd, {
      headers: { "Content-Type": "multipart/form-data" },
    });
  },

  // retourne List<ImageDto> côté backend
  getImages: (testOrderId: string) =>
    apiClient.get<ImageDto[]>(`/test-orders/${testOrderId}/images`),

  deleteImage: (testOrderId: string, index: number) =>
    apiClient.delete(`/test-orders/${testOrderId}/images/${index}`),

  // Les détails sont gérés via create/update (body) — ces endpoints n'existent pas côté backend
  // addDetail, updateDetail, deleteDetail supprimés

  // @RequestParam labTestId (pas testId) côté backend
  getDiscount: (labTestId: string, contratId: string) =>
    apiClient.get<DiscountDto>(
      `/test-orders/discount`,
      { params: { labTestId, contratId } }
    ),

  // Assigner un médecin anatomopathologiste
  assignDoctor: (id: string, doctorId: string) =>
    apiClient.post(`/test-orders/${id}/assign-doctor`, { doctorId }),

  // Livrer une demande d'examen
  deliver: (id: string) => apiClient.post(`/test-orders/${id}/deliver`),

  // Mon Espace
  getMySpace: () =>
    apiClient.get<MySpaceStats>("/test-orders/myspace/stats"),

  getMyOrders: (params: {
    status: "PENDING" | "VALIDATED" | "DELIVERED" | "CANCELLED";
    typeOrderId?: string;
    priority?: string;
    page?: number;
    size?: number;
  }) =>
    apiClient.get<PageResponse<TestOrder>>("/test-orders/myspace/orders", {
      params,
    }),
};
