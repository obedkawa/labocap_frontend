import { useEffect, useState } from "react";
import { useAuthStore } from "@/stores/auth.store";
import { Permission } from "@/lib/constants/permissions";

export function usePermissions() {
  const { hasPermission, hasAnyPermission, user } = useAuthStore();
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  return {
    can: (permission: Permission) => mounted && hasPermission(permission),
    canAny: (...permissions: Permission[]) => mounted && hasAnyPermission(...permissions),
    canAll: (...permissions: Permission[]) =>
      mounted && permissions.every((p) => hasPermission(p)),
    permissions: mounted ? (user?.permissions ?? []) : [],
  };
}
