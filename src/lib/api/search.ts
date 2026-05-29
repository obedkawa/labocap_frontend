import apiClient from "@/lib/api/client";

export interface SearchPatient {
  id: string;
  code?: string;
  firstname: string;
  lastname: string;
  telephone1?: string;
}

export interface SearchTestOrder {
  id: string;
  code?: string;
  date?: string;
  patientName?: string;
  status?: string;
}

export interface SearchInvoice {
  id: string;
  code?: string;
  date?: string;
  total?: number;
  status?: string;
}

export interface SearchResults {
  patients: SearchPatient[];
  testOrders: SearchTestOrder[];
  invoices: SearchInvoice[];
}

export const searchApi = {
  search: (query: string) =>
    apiClient.get<SearchResults>("/search", { params: { q: query } }),
};
