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
import { typeOrdersApi, type TypeOrder } from "@/lib/api/examens";
import type { ApiError } from "@/types/api";

// ---------------------------------------------------------------------------
// Zod schema
// ---------------------------------------------------------------------------

const typeOrderSchema = z.object({
  title: z.string().min(1, "Le titre est requis"),
});

type TypeOrderFormData = z.infer<typeof typeOrderSchema>;

// ---------------------------------------------------------------------------
// Form fields
// ---------------------------------------------------------------------------

interface TypeOrderFormFieldsProps {
  register: ReturnType<typeof useForm<TypeOrderFormData>>["register"];
  errors: ReturnType<
    typeof useForm<TypeOrderFormData>
  >["formState"]["errors"];
}

function TypeOrderFormFields({ register, errors }: TypeOrderFormFieldsProps) {
  return (
    <div className="flex flex-col gap-4">
      {/* Titre */}
      <div className="flex flex-col gap-1">
        <label className="text-sm font-medium text-gray-700">
          Titre <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          {...register("title")}
          className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
        {errors.title && (
          <p className="text-xs text-red-500">{errors.title.message}</p>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export default function TypesExamensPage() {
  const { can } = usePermissions();
  const queryClient = useQueryClient();

  // --- State
  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [selectedType, setSelectedType] = useState<TypeOrder | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<TypeOrder | null>(null);

  // --- Forms
  const {
    register: registerCreate,
    handleSubmit: handleSubmitCreate,
    formState: { errors: createErrors },
    reset: resetCreate,
  } = useForm<TypeOrderFormData>({ resolver: zodResolver(typeOrderSchema) });

  const {
    register: registerEdit,
    handleSubmit: handleSubmitEdit,
    formState: { errors: editErrors },
    reset: resetEdit,
  } = useForm<TypeOrderFormData>({ resolver: zodResolver(typeOrderSchema) });

  // --- Query
  const { data: typeOrders = [], isLoading } = useQuery<TypeOrder[]>({
    queryKey: ["type-orders"],
    queryFn: () => typeOrdersApi.findAll().then((r) => r.data),
  });

  // --- Mutations
  const createMutation = useMutation({
    mutationFn: (payload: { title: string }) => typeOrdersApi.create(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["type-orders"] });
      toast.success("Type d'examen créé avec succès");
      setCreateOpen(false);
      resetCreate();
    },
    onError: (err: AxiosError<ApiError>) => {
      toast.error(err.response?.data?.message ?? "Erreur lors de la création");
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: { title: string } }) =>
      typeOrdersApi.update(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["type-orders"] });
      toast.success("Type d'examen modifié avec succès");
      setEditOpen(false);
      setSelectedType(null);
      resetEdit();
    },
    onError: (err: AxiosError<ApiError>) => {
      toast.error(
        err.response?.data?.message ?? "Erreur lors de la modification"
      );
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => typeOrdersApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["type-orders"] });
      toast.success("Type d'examen supprimé avec succès");
      setDeleteConfirm(null);
    },
    onError: (err: AxiosError<ApiError>) => {
      toast.error(
        err.response?.data?.message ?? "Erreur lors de la suppression"
      );
    },
  });

  // --- Handlers
  const handleOpenEdit = (type: TypeOrder) => {
    setSelectedType(type);
    resetEdit({ title: type.title });
    setEditOpen(true);
  };

  const handleCloseCreate = () => {
    setCreateOpen(false);
    resetCreate();
  };

  const handleCloseEdit = () => {
    setEditOpen(false);
    setSelectedType(null);
    resetEdit();
  };

  const onCreateSubmit = (formData: TypeOrderFormData) => {
    createMutation.mutate(formData);
  };

  const onEditSubmit = (formData: TypeOrderFormData) => {
    if (!selectedType) return;
    updateMutation.mutate({ id: selectedType.id, payload: formData });
  };

  // --- Columns
  const columns: ColumnDef<TypeOrder>[] = [
    {
      header: "Titre",
      accessorKey: "title",
    },
    {
      header: "Actions",
      id: "actions",
      cell: ({ row }) => {
        const type = row.original;
        return (
          <div className="flex items-center gap-2">
            <PermissionGate permission={PERMISSIONS.EDIT_TESTS}>
              <button
                type="button"
                onClick={() => handleOpenEdit(type)}
                className="inline-flex items-center justify-center rounded p-1.5 text-gray-500 hover:bg-gray-100 hover:text-blue-600 transition-colors"
                title="Modifier"
              >
                <Pencil className="h-4 w-4" />
              </button>
            </PermissionGate>

            <PermissionGate permission={PERMISSIONS.DELETE_TESTS}>
              <button
                type="button"
                onClick={() => setDeleteConfirm(type)}
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
        title="Types d'examens"
        action={
          can(PERMISSIONS.CREATE_TESTS) ? (
            <button
              type="button"
              onClick={() => setCreateOpen(true)}
              className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700"
            >
              <Plus className="h-4 w-4" />
              Ajouter un type
            </button>
          ) : undefined
        }
      />

      <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <DataTable
          columns={columns}
          data={typeOrders}
          isLoading={isLoading}
        />
      </div>

      {/* Modal Création */}
      <CrudModal
        isOpen={createOpen}
        onClose={handleCloseCreate}
        title="Ajouter un type d'examen"
        onSubmit={handleSubmitCreate(onCreateSubmit)}
        submitLabel="Ajouter"
        isSubmitting={createMutation.isPending}
      >
        <TypeOrderFormFields register={registerCreate} errors={createErrors} />
      </CrudModal>

      {/* Modal Édition */}
      <CrudModal
        isOpen={editOpen}
        onClose={handleCloseEdit}
        title="Modifier le type d'examen"
        onSubmit={handleSubmitEdit(onEditSubmit)}
        submitLabel="Modifier"
        isSubmitting={updateMutation.isPending}
      >
        <TypeOrderFormFields register={registerEdit} errors={editErrors} />
      </CrudModal>

      {/* Confirm suppression */}
      <ConfirmModal
        isOpen={deleteConfirm !== null}
        onClose={() => setDeleteConfirm(null)}
        onConfirm={() => {
          if (deleteConfirm) deleteMutation.mutate(deleteConfirm.id);
        }}
        title="Supprimer ce type d'examen"
        message={
          deleteConfirm
            ? `Voulez-vous vraiment supprimer le type "${deleteConfirm.title}" ? Cette action est irréversible.`
            : ""
        }
        confirmLabel="Supprimer"
        confirmVariant="danger"
        isLoading={deleteMutation.isPending}
      />
    </div>
  );
}
