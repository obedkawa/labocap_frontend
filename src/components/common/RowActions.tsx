"use client";

import type { ReactNode } from "react";
import { Pencil, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/Button";
import { IconButton } from "@/components/ui/IconButton";
import { PermissionGate } from "@/components/common/PermissionGate";
import type { Permission } from "@/lib/constants/permissions";

interface RowActionsProps {
  onEdit?: () => void;
  onDelete?: () => void;
  /** Permission requise pour afficher le bouton Modifier (sinon toujours affiché). */
  editPermission?: Permission | Permission[];
  /** Permission requise pour afficher le bouton Supprimer (sinon toujours affiché). */
  deletePermission?: Permission | Permission[];
  editLabel?: string;
  deleteLabel?: string;
  /**
   * Conservé pour compatibilité. Le défaut est désormais l'icône seule, comme
   * dans l'app Laravel ; passer `false` réaffiche les libellés.
   */
  iconOnly?: boolean;
}

/** Enveloppe le bouton dans un PermissionGate uniquement si une permission est fournie. */
function Guarded({
  permission,
  children,
}: {
  permission?: Permission | Permission[];
  children: ReactNode;
}) {
  if (!permission) return <>{children}</>;
  return <PermissionGate permission={permission}>{children}</PermissionGate>;
}

/**
 * Boutons d'action d'une ligne de tableau (Modifier / Supprimer), chacun
 * conditionné par une permission. Réutilisable dans toutes les DataTable CRUD.
 */
export function RowActions({
  onEdit,
  onDelete,
  editPermission,
  deletePermission,
  editLabel = "Modifier",
  deleteLabel = "Supprimer",
  iconOnly = true,
}: RowActionsProps) {
  return (
    <div className="flex items-center gap-2">
      {onEdit && (
        <Guarded permission={editPermission}>
          {iconOnly ? (
            <IconButton
              variant="edit"
              onClick={onEdit}
              title={editLabel}
              icon={<Pencil className="h-4 w-4" />}
            />
          ) : (
            <Button
              size="sm"
              variant="primary"
              onClick={onEdit}
              title={editLabel}
              icon={<Pencil className="h-3.5 w-3.5" />}
            >
              {editLabel}
            </Button>
          )}
        </Guarded>
      )}

      {onDelete && (
        <Guarded permission={deletePermission}>
          {iconOnly ? (
            <IconButton
              variant="delete"
              onClick={onDelete}
              title={deleteLabel}
              icon={<Trash2 className="h-4 w-4" />}
            />
          ) : (
            <Button
              size="sm"
              variant="danger"
              onClick={onDelete}
              title={deleteLabel}
              icon={<Trash2 className="h-3.5 w-3.5" />}
            >
              {deleteLabel}
            </Button>
          )}
        </Guarded>
      )}
    </div>
  );
}
