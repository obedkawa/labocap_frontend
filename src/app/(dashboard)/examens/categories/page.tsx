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
import { categoryTestsApi, type CategoryTest } from "@/lib/api/examens";
import type { PageResponse, ApiError } from "@/types/api";

// ---------------------------------------------------------------------------
// Zod schema
// ---------------------------------------------------------------------------

const categorySchema = z.object({
  code: z.string().length(2, "Le code doit faire exactement 2 caractères"),
  name: z.string().min(1, "Le nom est requis"),
});

type CategoryFormData = z.infer<typeof categorySchema>;

// ---------------------------------------------------------------------------
// Form fields
// ---------------------------------------------------------------------------

interface CategoryFormFieldsProps {
  register: ReturnType<typeof useForm<CategoryFormData>>["register"];
  errors: ReturnType<typeof useForm<CategoryFormData>>["formState"]["errors"];
}

function CategoryFormFields({ register, errors }: CategoryFormFieldsProps) {
  return (
    <div className="flex flex-col gap-4">
      {/* Code */}
      <div className="flex flex-col gap-1">
        <label className="text-sm font-medium text-gray-700">
          Code <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          maxLength={2}
          placeholder="ex : CF"
          {...register("code")}
          className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
        {errors.code && (
          <p className="text-xs text-red-500">{errors.code.message}</p>
        )}
      </div>

      {/* Nom */}
      <div className="flex flex-col gap-1">
        <label className="text-sm font-medium text-gray-700">
          Nom <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          {...register("name")}
          className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
        {errors.name && (
          <p className="text-xs text-red-500">{errors.name.message}</p>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export default function CategoriesExamensPage() {
  const { can } = usePermissions();
  const queryClient = useQueryClient();

  // --- State
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(10);

  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] =
    useState<CategoryTest | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<CategoryTest | null>(null);

  // --- Forms
  const {
    register: registerCreate,
    handleSubmit: handleSubmitCreate,
    formState: { errors: createErrors },
    reset: resetCreate,
  } = useForm<CategoryFormData>({ resolver: zodResolver(categorySchema) });

  const {
    register: registerEdit,
    handleSubmit: handleSubmitEdit,
    formState: { errors: editErrors },
    reset: resetEdit,
  } = useForm<CategoryFormData>({ resolver: zodResolver(categorySchema) });

  // --- Query
  const { data, isLoading } = useQuery<PageResponse<CategoryTest>>({
    queryKey: ["category-tests", { page, size: pageSize }],
    queryFn: () =>
      categoryTestsApi.findAll({ page, size: pageSize }).then((r) => r.data),
  });

  const categories = data?.content ?? [];
  const pageCount = data?.totalPages ?? 0;

  // --- Mutations
  const createMutation = useMutation({
    mutationFn: (payload: { code: string; name: string }) =>
      categoryTestsApi.create(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["category-tests"] });
      toast.success("Catégorie créée avec succès");
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
      payload: { code: string; name: string };
    }) => categoryTestsApi.update(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["category-tests"] });
      toast.success("Catégorie modifiée avec succès");
      setEditOpen(false);
      setSelectedCategory(null);
      resetEdit();
    },
    onError: (err: AxiosError<ApiError>) => {
      toast.error(
        err.response?.data?.message ?? "Erreur lors de la modification"
      );
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => categoryTestsApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["category-tests"] });
      toast.success("Catégorie supprimée avec succès");
      setDeleteConfirm(null);
    },
    onError: (err: AxiosError<ApiError>) => {
      toast.error(
        err.response?.data?.message ?? "Erreur lors de la suppression"
      );
    },
  });

  // --- Handlers
  const handleOpenEdit = (category: CategoryTest) => {
    setSelectedCategory(category);
    resetEdit({ code: category.code, name: category.name });
    setEditOpen(true);
  };

  const handleCloseCreate = () => {
    setCreateOpen(false);
    resetCreate();
  };

  const handleCloseEdit = () => {
    setEditOpen(false);
    setSelectedCategory(null);
    resetEdit();
  };

  const onCreateSubmit = (formData: CategoryFormData) => {
    createMutation.mutate(formData);
  };

  const onEditSubmit = (formData: CategoryFormData) => {
    if (!selectedCategory) return;
    updateMutation.mutate({ id: selectedCategory.id, payload: formData });
  };

  // --- Columns
  const columns: ColumnDef<CategoryTest>[] = [
    {
      header: "Code",
      accessorKey: "code",
    },
    {
      header: "Nom de la catégorie",
      accessorKey: "name",
    },
    {
      header: "Actions",
      id: "actions",
      cell: ({ row }) => {
        const category = row.original;
        return (
          <div className="flex items-center gap-2">
            <PermissionGate permission={PERMISSIONS.EDIT_TESTS}>
              <button
                type="button"
                onClick={() => handleOpenEdit(category)}
                className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs font-medium bg-blue-600 text-white hover:bg-blue-700 transition-colors"
                title="Modifier"
              >
                <Pencil className="h-3.5 w-3.5" />
                Modifier
              </button>
            </PermissionGate>

            <PermissionGate permission={PERMISSIONS.DELETE_TESTS}>
              <button
                type="button"
                onClick={() => setDeleteConfirm(category)}
                className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs font-medium bg-red-600 text-white hover:bg-red-700 transition-colors"
                title="Supprimer"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Supprimer
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
        title="Catégories d'examens"
        action={
          can(PERMISSIONS.CREATE_TESTS) ? (
            <button
              type="button"
              onClick={() => setCreateOpen(true)}
              className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700"
            >
              <Plus className="h-4 w-4" />
              Ajouter une catégorie
            </button>
          ) : undefined
        }
      />

      <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <DataTable
          columns={columns}
          data={categories}
          isLoading={isLoading}
          pageCount={pageCount}
          pageIndex={page}
          pageSize={pageSize}
          onPageChange={setPage}
          onPageSizeChange={(size) => {
            setPageSize(size);
            setPage(0);
          }}
        />
      </div>

      {/* Modal Création */}
      <CrudModal
        isOpen={createOpen}
        onClose={handleCloseCreate}
        title="Ajouter une catégorie"
        onSubmit={handleSubmitCreate(onCreateSubmit)}
        submitLabel="Ajouter une catégorie"
        isSubmitting={createMutation.isPending}
      >
        <CategoryFormFields register={registerCreate} errors={createErrors} />
      </CrudModal>

      {/* Modal Édition */}
      <CrudModal
        isOpen={editOpen}
        onClose={handleCloseEdit}
        title="Modifier la catégorie"
        onSubmit={handleSubmitEdit(onEditSubmit)}
        submitLabel="Modifier"
        isSubmitting={updateMutation.isPending}
      >
        <CategoryFormFields register={registerEdit} errors={editErrors} />
      </CrudModal>

      {/* Confirm suppression */}
      <ConfirmModal
        isOpen={deleteConfirm !== null}
        onClose={() => setDeleteConfirm(null)}
        onConfirm={() => {
          if (deleteConfirm) deleteMutation.mutate(deleteConfirm.id);
        }}
        title="Supprimer cette catégorie"
        message={
          deleteConfirm
            ? `Voulez-vous vraiment supprimer la catégorie "${deleteConfirm.name}" ? Cette action est irréversible.`
            : ""
        }
        confirmLabel="Supprimer"
        confirmVariant="danger"
        isLoading={deleteMutation.isPending}
      />
    </div>
  );
}
