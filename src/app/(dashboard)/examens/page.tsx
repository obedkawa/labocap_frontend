"use client";

import { useEffect, useState } from "react";
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
import { StatusBadge } from "@/components/ui/StatusBadge";
import { usePermissions } from "@/hooks/usePermissions";
import { PERMISSIONS } from "@/lib/constants/permissions";
import { formatCFA } from "@/lib/utils";
import {
  labTestsApi,
  categoryTestsApi,
  type LabTest,
  type CategoryTest,
} from "@/lib/api/examens";
import type { PageResponse, ApiError } from "@/types/api";

// ---------------------------------------------------------------------------
// Zod schema
// ---------------------------------------------------------------------------

const labTestSchema = z.object({
  categoryTestId: z.string().min(1, "La catégorie est requise"),
  name: z.string().min(1, "Le nom est requis"),
  price: z.string().min(1, "Le prix est requis"),
  status: z.string().min(1, "Le statut est requis"),
});

type LabTestFormData = z.infer<typeof labTestSchema>;

// ---------------------------------------------------------------------------
// Form fields
// ---------------------------------------------------------------------------

interface LabTestFormFieldsProps {
  register: ReturnType<typeof useForm<LabTestFormData>>["register"];
  errors: ReturnType<typeof useForm<LabTestFormData>>["formState"]["errors"];
  categories: CategoryTest[];
}

function LabTestFormFields({
  register,
  errors,
  categories,
}: LabTestFormFieldsProps) {
  return (
    <div className="flex flex-col gap-4">
      {/* Catégorie */}
      <div className="flex flex-col gap-1">
        <label className="text-sm font-medium text-gray-700">
          Catégorie parente <span className="text-red-500">*</span>
        </label>
        <select
          {...register("categoryTestId")}
          className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        >
          <option value="">Sélectionner une catégorie</option>
          {categories.map((cat) => (
            <option key={cat.id} value={cat.id}>
              {cat.name}
            </option>
          ))}
        </select>
        {errors.categoryTestId && (
          <p className="text-xs text-red-500">{errors.categoryTestId.message}</p>
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

      {/* Prix */}
      <div className="flex flex-col gap-1">
        <label className="text-sm font-medium text-gray-700">
          Prix <span className="text-red-500">*</span>
        </label>
        <input
          type="number"
          min={0}
          {...register("price")}
          className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
        {errors.price && (
          <p className="text-xs text-red-500">{errors.price.message}</p>
        )}
      </div>

      {/* Statut */}
      <div className="flex flex-col gap-1">
        <label className="text-sm font-medium text-gray-700">
          Statut <span className="text-red-500">*</span>
        </label>
        <select
          {...register("status")}
          className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        >
          <option value="ACTIF">ACTIF</option>
          <option value="INACTIF">INACTIF</option>
        </select>
        {errors.status && (
          <p className="text-xs text-red-500">{errors.status.message}</p>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export default function ExamensPage() {
  const { can } = usePermissions();
  const queryClient = useQueryClient();

  // --- State
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(10);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  // Filtrage en direct : on déclenche la recherche pendant la frappe,
  // avec un léger debounce pour éviter une requête à chaque caractère.
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(searchInput);
      setPage(0);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [selectedTest, setSelectedTest] = useState<LabTest | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<LabTest | null>(null);

  // --- Forms
  const {
    register: registerCreate,
    handleSubmit: handleSubmitCreate,
    formState: { errors: createErrors },
    reset: resetCreate,
  } = useForm<LabTestFormData>({
    resolver: zodResolver(labTestSchema),
    defaultValues: { categoryTestId: "", name: "", price: "", status: "ACTIF" },
  });

  const {
    register: registerEdit,
    handleSubmit: handleSubmitEdit,
    formState: { errors: editErrors },
    reset: resetEdit,
  } = useForm<LabTestFormData>({ resolver: zodResolver(labTestSchema) });

  // --- Queries
  const { data, isLoading } = useQuery<PageResponse<LabTest>>({
    queryKey: ["lab-tests", { page, size: pageSize, search, status: statusFilter }],
    queryFn: () =>
      labTestsApi
        .findAll({
          page,
          size: pageSize,
          search: search || undefined,
          status: statusFilter || undefined,
        })
        .then((r) => r.data),
  });

  const { data: categoriesData } = useQuery<PageResponse<CategoryTest>>({
    queryKey: ["category-tests-all"],
    queryFn: () =>
      categoryTestsApi.findAll({ size: 200 }).then((r) => r.data),
  });

  const tests = data?.content ?? [];
  const pageCount = data?.totalPages ?? 0;
  const categories = categoriesData?.content ?? [];

  // --- Mutations
  const createMutation = useMutation({
    mutationFn: (payload: {
      name: string;
      price: number;
      categoryTestId: string;
      status: string;
    }) => labTestsApi.create(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["lab-tests"] });
      toast.success("Examen créé avec succès");
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
      payload: { name: string; price: number; categoryTestId: string; status: string };
    }) => labTestsApi.update(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["lab-tests"] });
      toast.success("Examen modifié avec succès");
      setEditOpen(false);
      setSelectedTest(null);
      resetEdit();
    },
    onError: (err: AxiosError<ApiError>) => {
      toast.error(
        err.response?.data?.message ?? "Erreur lors de la modification"
      );
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => labTestsApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["lab-tests"] });
      toast.success("Examen supprimé avec succès");
      setDeleteConfirm(null);
    },
    onError: (err: AxiosError<ApiError>) => {
      toast.error(
        err.response?.data?.message ?? "Erreur lors de la suppression"
      );
    },
  });

  // --- Handlers
  const handleOpenEdit = (test: LabTest) => {
    setSelectedTest(test);
    resetEdit({
      categoryTestId: test.categoryTestId,
      name: test.name,
      price: String(test.price ?? ""),
      status: test.status ?? "ACTIF",
    });
    setEditOpen(true);
  };

  const handleCloseCreate = () => {
    setCreateOpen(false);
    resetCreate();
  };

  const handleCloseEdit = () => {
    setEditOpen(false);
    setSelectedTest(null);
    resetEdit();
  };

  const onCreateSubmit = (formData: LabTestFormData) => {
    createMutation.mutate({
      name: formData.name,
      price: Number(formData.price),
      categoryTestId: formData.categoryTestId,
      status: formData.status,
    });
  };

  const onEditSubmit = (formData: LabTestFormData) => {
    if (!selectedTest) return;
    updateMutation.mutate({
      id: selectedTest.id,
      payload: {
        name: formData.name,
        price: Number(formData.price),
        categoryTestId: formData.categoryTestId,
        status: formData.status,
      },
    });
  };

  // --- Columns
  const columns: ColumnDef<LabTest>[] = [
    {
      header: "Nom",
      accessorKey: "name",
    },
    {
      header: "Catégorie",
      accessorKey: "categoryTestName",
    },
    {
      header: "Prix",
      id: "price",
      cell: ({ row }) => formatCFA(row.original.price),
    },
    {
      header: "Statut",
      id: "status",
      cell: ({ row }) => (
        <StatusBadge status={row.original.status} domain="general" />
      ),
    },
    {
      header: "Actions",
      id: "actions",
      cell: ({ row }) => {
        const test = row.original;
        return (
          <div className="flex items-center gap-2">
            <PermissionGate permission={PERMISSIONS.EDIT_TESTS}>
              <button
                type="button"
                onClick={() => handleOpenEdit(test)}
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
                onClick={() => setDeleteConfirm(test)}
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
        title="Catalogue d'examens"
        action={
          can(PERMISSIONS.CREATE_TESTS) ? (
            <button
              type="button"
              onClick={() => setCreateOpen(true)}
              className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700"
            >
              <Plus className="h-4 w-4" />
              Ajouter un examen
            </button>
          ) : undefined
        }
      />

      <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        {/* Filtres */}
        <div className="flex gap-3 mb-4">
          <input
            type="text"
            placeholder="Rechercher..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 max-w-xs w-full"
          />
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(0);
            }}
            className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            <option value="">Tous</option>
            <option value="ACTIF">ACTIF</option>
            <option value="INACTIF">INACTIF</option>
          </select>
        </div>

        <DataTable
          columns={columns}
          data={tests}
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
        title="Ajouter un examen"
        onSubmit={handleSubmitCreate(onCreateSubmit)}
        submitLabel="Ajouter un examen"
        isSubmitting={createMutation.isPending}
      >
        <LabTestFormFields
          register={registerCreate}
          errors={createErrors}
          categories={categories}
        />
      </CrudModal>

      {/* Modal Édition */}
      <CrudModal
        isOpen={editOpen}
        onClose={handleCloseEdit}
        title="Modifier l'examen"
        onSubmit={handleSubmitEdit(onEditSubmit)}
        submitLabel="Modifier"
        isSubmitting={updateMutation.isPending}
      >
        <LabTestFormFields
          register={registerEdit}
          errors={editErrors}
          categories={categories}
        />
      </CrudModal>

      {/* Confirm suppression */}
      <ConfirmModal
        isOpen={deleteConfirm !== null}
        onClose={() => setDeleteConfirm(null)}
        onConfirm={() => {
          if (deleteConfirm) deleteMutation.mutate(deleteConfirm.id);
        }}
        title="Supprimer cet examen"
        message={
          deleteConfirm
            ? `Voulez-vous vraiment supprimer l'examen "${deleteConfirm.name}" ? Cette action est irréversible.`
            : ""
        }
        confirmLabel="Supprimer"
        confirmVariant="danger"
        isLoading={deleteMutation.isPending}
      />
    </div>
  );
}
