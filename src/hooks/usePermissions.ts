import { useAuthStore } from "@/stores/auth.store";
import { Permission } from "@/lib/constants/permissions";
import { useHydrated } from "@/hooks/useHydrated";

export function usePermissions() {
  const { hasPermission, hasAnyPermission, user } = useAuthStore();
  // Les permissions viennent d'un store persisté : on ne les évalue qu'une fois
  // hydraté, pour que le rendu serveur et le premier rendu client concordent.
  const mounted = useHydrated();

  return {
    can: (permission: Permission) => mounted && hasPermission(permission),
    canAny: (...permissions: Permission[]) => mounted && hasAnyPermission(...permissions),
    canAll: (...permissions: Permission[]) =>
      mounted && permissions.every((p) => hasPermission(p)),
    permissions: mounted ? (user?.permissions ?? []) : [],
  };
}
