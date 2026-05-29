import apiClient from "./client";

export interface User {
  id: string;
  firstname: string;
  lastname: string;
  email: string;
  phone?: string;
  roles?: Role[];
  permissions?: string[];
  isActive: boolean;
  createdAt: string;
}

export interface UserRequest {
  firstname: string;
  lastname: string;
  email: string;
  phone?: string;
  password?: string;
  roleIds?: string[];
}

export interface PermissionResponseDto {
  id: string;
  name: string;
  slug: string;
}

export interface Role {
  id: string;
  name: string;
  description?: string;
  permissions: PermissionResponseDto[];
}

export interface RoleRequest {
  name: string;
  description?: string;
  permissionIds?: string[];
}

export interface Permission {
  id: string;
  name: string;
  slug: string;
  description?: string;
}

export interface SettingsData {
  // Labo
  labName?: string;
  labAddress?: string;
  labPhone?: string;
  labEmail?: string;
  labLogo?: string;
  // Facturation
  invoicePrefix?: string;
  taxRate?: string;
  mecefIfu?: string;
  mecefNimf?: string;
  // Rapports
  reportFooter?: string;
}

// Mapping des clés frontend vers les slugs backend
const SETTINGS_KEY_MAP: Record<keyof Omit<SettingsData, "labLogo">, string> = {
  labName: "lab_name",
  labAddress: "lab_address",
  labPhone: "lab_phone",
  labEmail: "lab_email",
  invoicePrefix: "invoice_prefix",
  taxRate: "tax_rate",
  mecefIfu: "mecef_ifu",
  mecefNimf: "mecef_nimf",
  reportFooter: "report_footer",
};

interface BackendSetting {
  id: string;
  key: string;
  value: string;
  placeholder?: string;
  ico?: string;
  branchId?: string;
}

interface PageResponse<T> {
  content: T[];
  totalElements: number;
  totalPages: number;
  size: number;
  number: number;
}

export const usersApi = {
  findAll: (params?: Record<string, unknown>) =>
    apiClient.get<{ content: User[]; totalElements: number; totalPages: number }>(
      "/users",
      { params }
    ),
  findById: (id: string) => apiClient.get<User>(`/users/${id}`),
  create: (data: UserRequest) => apiClient.post<User>("/users", data),
  update: (id: string, data: Partial<UserRequest>) =>
    apiClient.put<User>(`/users/${id}`, data),
  delete: (id: string) => apiClient.delete(`/users/${id}`),
  getRoles: () =>
    apiClient.get<PageResponse<Role>>("/roles", { params: { size: 100 } }),
  createRole: (data: RoleRequest) =>
    apiClient.post("/roles", data),
  updateRole: (id: string, data: RoleRequest) =>
    apiClient.put(`/roles/${id}`, data),
  deleteRole: (id: string) => apiClient.delete(`/roles/${id}`),
  getAllPermissions: () => apiClient.get<Permission[]>("/permissions"),

  // ---- Permissions directes par utilisateur ----
  getUserPermissions: (userId: string) =>
    apiClient.get<PermissionResponseDto[]>(`/users/${userId}/permissions`),
  setUserPermissions: (userId: string, permissionIds: string[]) =>
    apiClient.put(`/users/${userId}/permissions`, permissionIds),
  getSettings: async (): Promise<{ data: SettingsData }> => {
    const response = await apiClient.get<PageResponse<BackendSetting>>(
      "/settings",
      { params: { size: 100 } }
    );
    const list: BackendSetting[] = response.data?.content ?? [];
    const reverseMap = Object.fromEntries(
      Object.entries(SETTINGS_KEY_MAP).map(([k, v]) => [v, k])
    );
    const result: SettingsData = {};
    for (const item of list) {
      const frontendKey = reverseMap[item.key] as keyof SettingsData | undefined;
      if (frontendKey) {
        (result as Record<string, string>)[frontendKey] = item.value;
      }
    }
    return { data: result };
  },
  updateSettings: async (data: SettingsData): Promise<void> => {
    for (const [frontendKey, backendKey] of Object.entries(SETTINGS_KEY_MAP)) {
      const value = (data as Record<string, string | undefined>)[frontendKey];
      if (value !== undefined) {
        await apiClient.post("/settings", { key: backendKey, value });
      }
    }
  },

  // ---- Setting-apps (global, toutes branches) ----
  getSettingApps: async (): Promise<Record<string, string>> => {
    const res = await apiClient.get<PageResponse<{ id: string; key: string; value: string; label?: string }>>("/setting-apps", { params: { size: 100 } });
    const map: Record<string, string> = {};
    for (const item of (res.data?.content ?? [])) {
      map[item.key] = item.value;
    }
    return map;
  },
  upsertSettingApp: (key: string, value: string) =>
    apiClient.post("/setting-apps", { key, value }),

  // ---- Token paiement MECeF (per-branch, clé token_payment) ----
  getTokenPayment: async (): Promise<string | undefined> => {
    const res = await apiClient.get<PageResponse<BackendSetting>>("/settings", { params: { size: 100 } });
    return (res.data?.content ?? []).find((s) => s.key === "token_payment")?.value;
  },
  setTokenPayment: (value: string) =>
    apiClient.post("/settings", { key: "token_payment", value }),
};
