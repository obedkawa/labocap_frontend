export interface User {
  id: string;
  firstname: string;
  lastname: string;
  email: string;
  phone?: string;
  signature?: string;
  branchId: string;
  roles: Role[];
  permissions: string[];
  isActive?: boolean;
  createdAt?: string;
}

export interface RolePermission {
  id: string;
  name: string;
  slug: string;
}

export interface Role {
  id: string;
  name: string;
  slug?: string;
  permissions: RolePermission[];
}

export interface LoginRequest {
  email: string;
  password: string;
  remember?: boolean;
}

export interface LoginResponse {
  user?: User;
  requires2fa?: boolean;
  expiresIn?: number;
  tempToken?: string;
}

export interface TwoFactorRequest {
  code: string;
  tempToken: string;
}

export interface ForgotPasswordRequest {
  email: string;
}

export interface ResetPasswordRequest {
  token: string;
  email: string;
  password: string;
  passwordConfirmation: string;
}
