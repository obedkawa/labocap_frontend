import apiClient from "./client";
import type { User } from "@/types/auth";

/**
 * Opérations de l'utilisateur sur son propre compte.
 *
 * Distinctes de `usersApi`, qui cible `/users/{id}` et exige la permission
 * `edit-users` : ces routes-ci ne demandent que d'être authentifié.
 */

export interface UpdateMyProfileRequest {
  firstname: string;
  lastname: string;
  phone?: string;
  /** Data-URL base64. Omis si la signature n'a pas changé. */
  signature?: string;
}

export interface UpdateMyEmailRequest {
  newEmail: string;
  currentPassword: string;
}

export interface UpdateMyPasswordRequest {
  currentPassword: string;
  newPassword: string;
}

export const meApi = {
  updateProfile: (data: UpdateMyProfileRequest) =>
    apiClient.put<User>("/users/me", data),

  updateEmail: (data: UpdateMyEmailRequest) =>
    apiClient.patch<User>("/users/me/email", data),

  updatePassword: (data: UpdateMyPasswordRequest) =>
    apiClient.patch<void>("/users/me/password", data),
};
