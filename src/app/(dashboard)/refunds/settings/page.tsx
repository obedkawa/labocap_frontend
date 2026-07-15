"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Pencil, Trash2 } from "lucide-react";
import type { ColumnDef } from "@tanstack/react-table";
import type { AxiosError } from "axios";

import { PageHeader } from "@/components/ui/PageHeader";
import { DataTable } from "@/components/common/DataTable";
import { CrudModal } from "@/components/common/CrudModal";
import { ConfirmModal } from "@/components/common/ConfirmModal";
import { PermissionGate } from "@/components/common/PermissionGate";
import { FormField } from "@/components/ui/FormField";
import { usePermissions } from "@/hooks/usePermissions";
import { PERMISSIONS } from "@/lib/constants/permissions";
import {
  refundReasonsApi,
  type RefundReason,
} from "@/lib/api/refunds";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const inputClass =
  "w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500";

const reasonSchema = z.object({
  label: z.string().min(1, { message: "Le libellé est requis" }),
});

type ReasonFormValues = z.infer<typeof reasonSchema>;

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function RefundReasonsSettingsPage() {
  return (
    <PermissionGate permission={PERMISSIONS.VIEW_REFUNDS}>
      <RefundReasonsContent />
    </PermissionGate>
  );
}

function RefundReasonsContent() {
  const { can } = usePermissions();
  const queryClient = useQueryClient();

  const [createOpen, setCreateOpen] = useState(false);
  const [editReason, setEditReason] = useState<RefundReason | null>(null);
  const [deleteReason, setDeleteReason] = useState<RefundReason | null>(null);

  // ---- Query ---------------------------------------------------------------

  const { data, isLoading } = useQuery({
    queryKey: ["refund-reasons"],
    queryFn: () => refundReasonsApi.findAll().then((r) => r.data),
  });

  const reasons: RefundReason[] = Array.isArray(data) ? data : [];

  // ---- Forms ---------------------------------------------------------------

  const createForm = useForm<ReasonFormValues>({
    resolver: zodResolver(reasonSchema),
    defaultValues: { label: "" },
  });

  const editForm = useForm<ReasonFormValues>({
    resolver: zodResolver(reasonSchema),
  });

  // ---- Mutations -----------------------------------------------------------

  const createMutation = useMutation({
    mutationFn: (values: ReasonFormValues) => refundReasonsApi.create(values),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["refund-reasons"] });
      toast.success("Motif créé");
      setCreateOpen(false);
      createForm.reset();
    },
    onError: (err: AxiosError) => {
      const msg =
        (err.response?.data as { message?: string })?.message ??
        "Une erreur est survenue";
      toast.error(msg);
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, values }: { id: string; values: ReasonFormValues }) =>
      refundReasonsApi.update(id, values),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["refund-reasons"] });
      toast.success("Motif mis à jour");
      setEditReason(null);
    },
    onError: (err: AxiosError) => {
      const msg =
        (err.response?.data as { message?: string })?.message ??
        "Une erreur est survenue";
      toast.error(msg);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => refundReasonsApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["refund-reasons"] });
      toast.success("Motif supprimé");
      setDeleteReason(null);
    },
    onError: (err: AxiosError) => {
      const msg =
        (err.response?.data as { message?: string })?.message ??
        "Une erreur est survenue";
      toast.error(msg);
    },
  });

  // ---- Handlers ------------------------------------------------------------

  function openEdit(reason: RefundReason) {
    setEditReason(reason);
    editForm.reset({ label: reason.label });
  }

  // ---- Columns -------------------------------------------------------------

  const columns: ColumnDef<RefundReason>[] = [
    {
      header: "#",
      id: "rownum",
      cell: ({ row }) => (
        <span className="text-sm text-gray-500">{row.index + 1}</span>
      ),
    },
    {
      header: "Motif",
      accessorKey: "label",
      cell: ({ row }) => (
        <span className="font-medium text-gray-900">{row.original.label}</span>
      ),
    },
    {
      header: "Actions",
      id: "actions",
      cell: ({ row }) => (
        <PermissionGate permission={PERMISSIONS.MANAGE_REFUNDS}>
          <div className="flex items-center gap-2">
            <button
              onClick={() => openEdit(row.original)}
              className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs font-medium bg-blue-600 text-white hover:bg-blue-700 transition-colors"
              aria-label="Modifier"
            >
              <Pencil className="h-3.5 w-3.5" />
              Modifier
            </button>
            <button
              onClick={() => setDeleteReason(row.original)}
              className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs font-medium bg-red-600 text-white hover:bg-red-700 transition-colors"
              aria-label="Supprimer"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Supprimer
            </button>
          </div>
        </PermissionGate>
      ),
    },
  ];

  // ---- Render --------------------------------------------------------------

  return (
    <div className="space-y-6">
      <PageHeader
        title="Motifs de remboursement"
        subtitle="Paramètres des motifs utilisés pour les demandes de remboursement"
        action={
          can(PERMISSIONS.MANAGE_REFUNDS) ? (
            <button
              onClick={() => {
                createForm.reset();
                setCreateOpen(true);
              }}
              className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
            >
              Ajouter un motif
            </button>
          ) : undefined
        }
      />

      <div className="rounded-xl border border-gray-200 bg-white shadow-sm p-5">
        <DataTable columns={columns} data={reasons} isLoading={isLoading} />
      </div>

      {/* Modal création */}
      <CrudModal
        isOpen={createOpen}
        onClose={() => setCreateOpen(false)}
        title="Ajouter un motif"
        onSubmit={createForm.handleSubmit((v) => createMutation.mutate(v))}
        submitLabel="Ajouter"
        isSubmitting={createMutation.isPending}
      >
        <FormField
          label="Libellé du motif"
          required
          error={createForm.formState.errors.label?.message}
        >
          <input
            type="text"
            {...createForm.register("label")}
            placeholder="Ex : Erreur de facturation"
            className={inputClass}
          />
        </FormField>
      </CrudModal>

      {/* Modal édition */}
      <CrudModal
        isOpen={editReason !== null}
        onClose={() => setEditReason(null)}
        title="Modifier le motif"
        onSubmit={editForm.handleSubmit((v) => {
          if (editReason) updateMutation.mutate({ id: editReason.id, values: v });
        })}
        submitLabel="Enregistrer"
        isSubmitting={updateMutation.isPending}
      >
        <FormField
          label="Libellé du motif"
          required
          error={editForm.formState.errors.label?.message}
        >
          <input
            type="text"
            {...editForm.register("label")}
            className={inputClass}
          />
        </FormField>
      </CrudModal>

      {/* Confirmation suppression */}
      <ConfirmModal
        isOpen={deleteReason !== null}
        onClose={() => setDeleteReason(null)}
        onConfirm={() => {
          if (deleteReason) deleteMutation.mutate(deleteReason.id);
        }}
        title="Supprimer ce motif"
        message={`Voulez-vous vraiment supprimer le motif « ${deleteReason?.label ?? ""} » ?`}
        confirmLabel="Supprimer"
        confirmVariant="danger"
        isLoading={deleteMutation.isPending}
      />
    </div>
  );
}
