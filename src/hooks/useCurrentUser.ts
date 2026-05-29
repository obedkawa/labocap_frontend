import { useAuthStore } from "@/stores/auth.store";

export function useCurrentUser() {
  const { user, isAuthenticated } = useAuthStore();
  return { user, isAuthenticated };
}
