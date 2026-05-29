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
import type { UseFormReturn } from "react-hook-form";

import { PageHeader } from "@/components/ui/PageHeader";
import { DataTable } from "@/components/common/DataTable";
import { CrudModal } from "@/components/common/CrudModal";
import { ConfirmModal } from "@/components/common/ConfirmModal";
import { PermissionGate } from "@/components/common/PermissionGate";
import { FormField } from "@/components/ui/FormField";
import { usePermissions } from "@/hooks/usePermissions";
import { PERMISSIONS } from "@/lib/constants/permissions";
import {
  suppliersApi,
  type Supplier,
  type SupplierRequest,
} from "@/lib/api/suppliers";
import apiClient from "@/lib/api/client";

// ---------------------------------------------------------------------------
// Zod schema
// ---------------------------------------------------------------------------

const supplierSchema = z.object({
  name: z.string().min(1, "Le nom est requis"),
  phone: z.string().optional(),
  email: z.string().email("Email invalide").optional().or(z.literal("")),
  address: z.string().optional(),
  information: z.string().optional(),
  categoryId: z.string().optional(),
});

type SupplierFormValues = z.infer<typeof supplierSchema>;

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------

const inputClass =
  "w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:bg-gray-50 disabled:text-gray-500";

function buildPayload(values: SupplierFormValues): SupplierRequest {
  return {
    name: values.name,
    phone: values.phone || undefined,
    email: values.email || undefined,
    address: values.address || undefined,
    information: values.information || undefined,
    categoryId: values.categoryId || undefined,
  };
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function SuppliersPage() {
  const { can } = usePermissions();
  const queryClient = useQueryClient();

  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(
    null
  );

  // ---- Queries & Mutations --------------------------------------------

  const { data, isLoading } = useQuery({
    queryKey: ["suppliers"],
    queryFn: () => suppliersApi.findAll().then((r) => r.data),
  });

  const { data: categories } = useQuery({
    queryKey: ["supplier-categories"],
    queryFn: () =>
      apiClient
        .get<Array<{ id: string; name: string }>>("/supplier-categories")
        .then((r) => r.data),
  });

  const suppliers: Supplier[] = data?.content ?? [];

  const createMutation = useMutation({
    mutationFn: (payload: SupplierRequest) => suppliersApi.create(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["suppliers"] });
      queryClient.invalidateQueries({ queryKey: ["suppliers-list"] });
      toast.success("Fournisseur créé");
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
    mutationFn: ({ id, data }: { id: string; data: SupplierRequest }) =>
      suppliersApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["suppliers"] });
      queryClient.invalidateQueries({ queryKey: ["suppliers-list"] });
      toast.success("Fournisseur modifié");
      setEditOpen(false);
    },
    onError: (err: AxiosError) => {
      const msg =
        (err.response?.data as { message?: string })?.message ??
        "Une erreur est survenue";
      toast.error(msg);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => suppliersApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["suppliers"] });
      queryClient.invalidateQueries({ queryKey: ["suppliers-list"] });
      toast.success("Fournisseur supprimé");
      setDeleteOpen(false);
      setSelectedSupplier(null);
    },
    onError: (err: AxiosError) => {
      const msg =
        (err.response?.data as { message?: string })?.message ??
        "Une erreur est survenue";
      toast.error(msg);
    },
  });

  // ---- Forms ---------------------------------------------------------

  const createForm = useForm<SupplierFormValues>({
    resolver: zodResolver(supplierSchema),
    defaultValues: {
      name: "",
      phone: "",
      email: "",
      address: "",
      information: "",
      categoryId: "",
    },
  });

  const editForm = useForm<SupplierFormValues>({
    resolver: zodResolver(supplierSchema),
  });

  // ---- Handlers ------------------------------------------------------

  function openEdit(supplier: Supplier) {
    setSelectedSupplier(supplier);
    editForm.reset({
      name: supplier.name,
      phone: supplier.phone ?? "",
      email: supplier.email ?? "",
      address: supplier.address ?? "",
      information: supplier.information ?? "",
      categoryId: supplier.categoryId ?? "",
    });
    setEditOpen(true);
  }

  function openDelete(supplier: Supplier) {
    setSelectedSupplier(supplier);
    setDeleteOpen(true);
  }

  function onCreateSubmit(values: SupplierFormValues) {
    createMutation.mutate(buildPayload(values));
  }

  function onEditSubmit(values: SupplierFormValues) {
    if (!selectedSupplier) return;
    updateMutation.mutate({ id: selectedSupplier.id, data: buildPayload(values) });
  }

  // ---- Columns -------------------------------------------------------

  const columns: ColumnDef<Supplier>[] = [
    {
      header: "Nom",
      accessorKey: "name",
    },
    {
      header: "Téléphone",
      accessorKey: "phone",
      cell: ({ row }) => row.original.phone ?? "—",
    },
    {
      header: "Email",
      accessorKey: "email",
      cell: ({ row }) => row.original.email ?? "—",
    },
    {
      header: "Adresse",
      accessorKey: "address",
      cell: ({ row }) => row.original.address ?? "—",
    },
    {
      header: "Actions",
      id: "actions",
      cell: ({ row }) => (
        <div className="flex items-center gap-2">
          <PermissionGate permission={PERMISSIONS.EDIT_SUPPLIERS}>
            <button
              onClick={() => openEdit(row.original)}
              className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs font-medium bg-blue-50 text-blue-700 hover:bg-blue-100 transition-colors"
              aria-label="Modifier"
            >
              <Pencil className="h-3.5 w-3.5" />
              Modifier
            </button>
          </PermissionGate>
          <PermissionGate permission={PERMISSIONS.DELETE_SUPPLIERS}>
            <button
              onClick={() => openDelete(row.original)}
              className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs font-medium bg-red-50 text-red-700 hover:bg-red-100 transition-colors"
              aria-label="Supprimer"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Supprimer
            </button>
          </PermissionGate>
        </div>
      ),
    },
  ];

  // ---- Render --------------------------------------------------------

  return (
    <div className="space-y-6">
      <PageHeader
        title="Fournisseurs"
        action={
          can(PERMISSIONS.CREATE_SUPPLIERS) ? (
            <button
              onClick={() => {
                createForm.reset();
                setCreateOpen(true);
              }}
              className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
            >
              Ajouter un fournisseur
            </button>
          ) : undefined
        }
      />

      <div className="rounded-xl border border-gray-200 bg-white shadow-sm p-5">
        <DataTable columns={columns} data={suppliers} isLoading={isLoading} />
      </div>

      {/* ---- Modal création ---- */}
      <CrudModal
        isOpen={createOpen}
        onClose={() => setCreateOpen(false)}
        title="Ajouter un fournisseur"
        size="lg"
        onSubmit={createForm.handleSubmit(onCreateSubmit)}
        submitLabel="Ajouter un fournisseur"
        isSubmitting={createMutation.isPending}
      >
        <SupplierForm form={createForm} categories={categories ?? []} />
      </CrudModal>

      {/* ---- Modal édition ---- */}
      <CrudModal
        isOpen={editOpen}
        onClose={() => setEditOpen(false)}
        title="Modifier un fournisseur"
        size="lg"
        onSubmit={editForm.handleSubmit(onEditSubmit)}
        submitLabel="Modifier"
        isSubmitting={updateMutation.isPending}
      >
        <SupplierForm form={editForm} categories={categories ?? []} />
      </CrudModal>

      {/* ---- Modal confirmation suppression ---- */}
      <ConfirmModal
        isOpen={deleteOpen}
        onClose={() => {
          setDeleteOpen(false);
          setSelectedSupplier(null);
        }}
        onConfirm={() => {
          if (selectedSupplier) deleteMutation.mutate(selectedSupplier.id);
        }}
        title="Supprimer ce fournisseur"
        message={`Voulez-vous vraiment supprimer le fournisseur "${selectedSupplier?.name ?? ""}" ? Cette action est irréversible.`}
        confirmLabel="Supprimer"
        confirmVariant="danger"
        isLoading={deleteMutation.isPending}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// SupplierForm
// ---------------------------------------------------------------------------

interface SupplierCategory {
  id: string;
  name: string;
}

interface SupplierFormProps {
  form: UseFormReturn<SupplierFormValues>;
  categories: SupplierCategory[];
}

function SupplierForm({ form, categories }: SupplierFormProps) {
  const {
    register,
    formState: { errors },
  } = form;

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <FormField label="Nom" required error={errors.name?.message}>
        <input
          type="text"
          {...register("name")}
          placeholder="Nom du fournisseur"
          className={inputClass}
        />
      </FormField>

      <FormField label="Catégorie" error={errors.categoryId?.message}>
        <select {...register("categoryId")} className={inputClass}>
          <option value="">— Sélectionner une catégorie —</option>
          {categories.map((cat) => (
            <option key={cat.id} value={cat.id}>
              {cat.name}
            </option>
          ))}
        </select>
      </FormField>

      <FormField label="Téléphone" error={errors.phone?.message}>
        <input
          type="tel"
          {...register("phone")}
          placeholder="97000000"
          className={inputClass}
        />
      </FormField>

      <FormField label="Email" error={errors.email?.message}>
        <input
          type="email"
          {...register("email")}
          placeholder="exemple@domaine.com"
          className={inputClass}
        />
      </FormField>

      <FormField label="Adresse" error={errors.address?.message}>
        <input
          type="text"
          {...register("address")}
          placeholder="Adresse du fournisseur"
          className={inputClass}
        />
      </FormField>

      <div className="sm:col-span-2">
        <FormField label="Informations" error={errors.information?.message}>
          <textarea
            {...register("information")}
            rows={4}
            placeholder="Informations complémentaires…"
            className={inputClass}
          />
        </FormField>
      </div>
    </div>
  );
}
