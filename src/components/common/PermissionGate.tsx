"use client";

import { Permission } from "@/lib/constants/permissions";
import { usePermissions } from "@/hooks/usePermissions";

interface PermissionGateProps {
  permission: Permission | Permission[];
  mode?: "any" | "all";
  fallback?: React.ReactNode;
  children: React.ReactNode;
}

export function PermissionGate({
  permission,
  mode = "any",
  fallback = null,
  children,
}: PermissionGateProps) {
  const { can, canAny, canAll } = usePermissions();

  const permissions = Array.isArray(permission) ? permission : [permission];

  const hasAccess =
    permissions.length === 1
      ? can(permissions[0])
      : mode === "all"
      ? canAll(...permissions)
      : canAny(...permissions);

  return hasAccess ? <>{children}</> : <>{fallback}</>;
}
