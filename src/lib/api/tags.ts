import apiClient from "./client";
import type { PageResponse } from "@/types/api";

export interface Tag {
  id: string;
  name: string;
  branchId?: string;
  createdAt?: string;
}

export const tagsApi = {
  findAll: (params?: { page?: number; size?: number }) =>
    apiClient.get<PageResponse<Tag>>("/tags", { params: { size: 200, ...params } }),
  create: (name: string) => apiClient.post<Tag>("/tags", { name }),
};
