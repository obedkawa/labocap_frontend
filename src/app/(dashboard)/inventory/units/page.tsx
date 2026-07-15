"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import type { AxiosError } from "axios";
import type { ColumnDef } from "@tanstack/react-table";

import { DataTable } from "@/components/common/DataTable";
import { CrudModal } from "@/components/common/CrudModal";
import { ConfirmModal } from "@/components/common/ConfirmModal";
import { PermissionGate } from "@/components/common/PermissionGate";
import { PageHeader } from "@/components/ui/PageHeader";
import { usePermissions } from "@/hooks/usePermissions";
import { PERMISSIONS } from "@/lib/constants/permissions";
import { unitesMesureApi, type UniteMesure } from "@/lib/api/examens";
import type { ApiError } from "@/types/api";

// ---------------------------------------------------------------------------
// Zod schema
// ---------------------------------------------------------------------------

const unitSchema = z.object({
  name: z.string().min(1, "Le nom est requis"),
  symbol: z.string().optional(),
});

type UnitFormData = z.infer<typeof unitSchema>;

// ---------------------------------------------------------------------------
// Form fields
// ---------------------------------------------------------------------------

interface UnitFormFieldsProps {
  register: ReturnType<typeof useForm<UnitFormData>>["register"];
  errors: ReturnType<typeof useForm<UnitFormData>>["formState"]["errors"];
}

function UnitFormFields({ register, errors }: UnitFormFieldsProps) {
  return (
    <div className="flex flex-col gap-4">
      {/* Nom */}
      <div className="flex flex-col gap-1">
        <label className="text-sm font-medium text-gray-700">
          Nom <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          {...register("name")}
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
        {errors.name && (
          <p className="text-xs text-red-500">{errors.name.message}</p>
        )}
      </div>

      {/* Symbole */}
      <div className="flex flex-col gap-1">
        <label className="text-sm font-medium text-gray-700">Symbole</label>
        <input
          type="text"
          {...register("symbol")}
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export default function UnitesMesurePage() {
  const { can } = usePermissions();
  const queryClient = useQueryClient();

  // --- State
  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [selectedUnit, setSelectedUnit] = useState<UniteMesure | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<UniteMesure | null>(null);

  // --- Forms
  const {
    register: registerCreate,
    handleSubmit: handleSubmitCreate,
    formState: { errors: createErrors },
    reset: resetCreate,
  } = useForm<UnitFormData>({ resolver: zodResolver(unitSchema) });

  const {
    register: registerEdit,
    handleSubmit: handleSubmitEdit,
    formState: { errors: editErrors },
    reset: resetEdit,
  } = useForm<UnitFormData>({ resolver: zodResolver(unitSchema) });

  // --- Query
  const { data: units = [], isLoading } = useQuery<UniteMesure[]>({
    queryKey: ["units"],
    queryFn: () => unitesMesureApi.findAll().then((r) => r.data),
  });

  // --- Mutations
  const createMutation = useMutation({
    mutationFn: (payload: { name: string; symbol?: string }) =>
      unitesMesureApi.create(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["units"] });
      toast.success("Unité créée avec succès");
      setCreateOpen(false);
      resetCreate();
    },
    onError: (err: AxiosError<ApiError>) => {
      toast.error(err.response?.data?.message ?? "Erreur lors de la création");
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({
      id,
      payload,
    }: {
      id: string;
      payload: { name: string; symbol?: string };
    }) => unitesMesureApi.update(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["units"] });
      toast.success("Unité modifiée avec succès");
      setEditOpen(false);
      setSelectedUnit(null);
      resetEdit();
    },
    onError: (err: AxiosError<ApiError>) => {
      toast.error(
        err.response?.data?.message ?? "Erreur lors de la modification"
      );
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => unitesMesureApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["units"] });
      toast.success("Unité supprimée avec succès");
      setDeleteConfirm(null);
    },
    onError: (err: AxiosError<ApiError>) => {
      toast.error(
        err.response?.data?.message ?? "Erreur lors de la suppression"
      );
    },
  });

  // --- Handlers
  const handleOpenEdit = (unit: UniteMesure) => {
    setSelectedUnit(unit);
    resetEdit({ name: unit.name, symbol: unit.symbol ?? "" });
    setEditOpen(true);
  };

  const handleCloseCreate = () => {
    setCreateOpen(false);
    resetCreate();
  };

  const handleCloseEdit = () => {
    setEditOpen(false);
    setSelectedUnit(null);
    resetEdit();
  };

  const onCreateSubmit = (formData: UnitFormData) => {
    createMutation.mutate({
      name: formData.name,
      symbol: formData.symbol || undefined,
    });
  };

  const onEditSubmit = (formData: UnitFormData) => {
    if (!selectedUnit) return;
    updateMutation.mutate({
      id: selectedUnit.id,
      payload: {
        name: formData.name,
        symbol: formData.symbol || undefined,
      },
    });
  };

  // --- Columns
  const columns: ColumnDef<UniteMesure>[] = [
    {
      header: "Nom",
      accessorKey: "name",
    },
    {
      header: "Symbole",
      id: "symbol",
      cell: ({ row }) => row.original.symbol ?? "—",
    },
    {
      header: "Actions",
      id: "actions",
      cell: ({ row }) => {
        const unit = row.original;
        return (
          <div className="flex items-center gap-2">
            <PermissionGate permission={PERMISSIONS.EDIT_ARTICLES}>
              <button
                type="button"
                onClick={() => handleOpenEdit(unit)}
                className="inline-flex items-center justify-center rounded p-1.5 text-gray-500 hover:bg-gray-100 hover:text-blue-600 transition-colors"
                title="Modifier"
              >
                <Pencil className="h-4 w-4" />
              </button>
            </PermissionGate>

            <PermissionGate permission={PERMISSIONS.DELETE_ARTICLES}>
              <button
                type="button"
                onClick={() => setDeleteConfirm(unit)}
                className="inline-flex items-center justify-center rounded p-1.5 text-gray-500 hover:bg-gray-100 hover:text-red-600 transition-colors"
                title="Supprimer"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </PermissionGate>
          </div>
        );
      },
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Unité de mesure"
        action={
          can(PERMISSIONS.CREATE_ARTICLES) ? (
            <button
              type="button"
              onClick={() => setCreateOpen(true)}
              className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700"
            >
              <Plus className="h-4 w-4" />
              Ajouter une unité
            </button>
          ) : undefined
        }
      />

      <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <DataTable
          columns={columns}
          data={units}
          isLoading={isLoading}
        />
      </div>

      {/* Modal Création */}
      <CrudModal
        isOpen={createOpen}
        onClose={handleCloseCreate}
        title="Ajouter une unité de mesure"
        onSubmit={handleSubmitCreate(onCreateSubmit)}
        submitLabel="Ajouter"
        isSubmitting={createMutation.isPending}
      >
        <UnitFormFields register={registerCreate} errors={createErrors} />
      </CrudModal>

      {/* Modal Édition */}
      <CrudModal
        isOpen={editOpen}
        onClose={handleCloseEdit}
        title="Modifier l'unité de mesure"
        onSubmit={handleSubmitEdit(onEditSubmit)}
        submitLabel="Modifier"
        isSubmitting={updateMutation.isPending}
      >
        <UnitFormFields register={registerEdit} errors={editErrors} />
      </CrudModal>

      {/* Confirm suppression */}
      <ConfirmModal
        isOpen={deleteConfirm !== null}
        onClose={() => setDeleteConfirm(null)}
        onConfirm={() => {
          if (deleteConfirm) deleteMutation.mutate(deleteConfirm.id);
        }}
        title="Supprimer cette unité"
        message={
          deleteConfirm
            ? `Voulez-vous vraiment supprimer l'unité "${deleteConfirm.name}" ? Cette action est irréversible.`
            : ""
        }
        confirmLabel="Supprimer"
        confirmVariant="danger"
        isLoading={deleteMutation.isPending}
      />
    </div>
  );
}
