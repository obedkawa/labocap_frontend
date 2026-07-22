import apiClient from "./client";

/**
 * Branche (agence/site) accessible par l'utilisateur, telle que renvoyée par
 * `GET /auth/branches` pour l'écran de sélection (analogue de la page
 * `select-branch` de Laravel).
 */
export interface UserBranch {
  id: string;
  name: string;
  code?: string | null;
  location?: string | null;
  isDefault: boolean;
}

export const branchesApi = {
  /**
   * Liste les branches accessibles par l'utilisateur connecté, branche(s) par
   * défaut en tête. Alimente l'écran de sélection de branche.
   */
  getMyBranches: () => apiClient.get<UserBranch[]>("/auth/branches"),
};
