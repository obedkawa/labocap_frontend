"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Pencil, Trash2 } from "lucide-react";
import ReactSelect from "react-select";
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
import { expensesApi, Expense, ExpenseRequest, PaymentMethod } from "@/lib/api/expenses";
import { suppliersApi } from "@/lib/api/suppliers";
import apiClient from "@/lib/api/client";
import type { PageResponse } from "@/types/api";

// ---------------------------------------------------------------------------
// Types locaux
// ---------------------------------------------------------------------------

interface ExpenseCategory {
  id: string;
  name: string;
  description?: string;
}

const PAYMENT_OPTIONS: { value: PaymentMethod; label: string }[] = [
  { value: "ESPECES", label: "Espèces" },
  { value: "CHEQUES", label: "Chèque" },
  { value: "MOBILEMONEY", label: "Mobile Money" },
  { value: "VIREMENT", label: "Virement" },
];

function paymentLabel(payment?: string): string {
  return PAYMENT_OPTIONS.find((p) => p.value === payment)?.label ?? payment ?? "—";
}

function paidLabel(paid: number): string {
  if (paid === 2) return "Payé + stock";
  if (paid === 1) return "Payé";
  return "Non payé";
}

// ---------------------------------------------------------------------------
// Zod schema — aligné sur ExpenseRequestDto
// ---------------------------------------------------------------------------

const expenseSchema = z.object({
  amount: z.string().min(1, { message: "Le montant est requis" }),
  expenseCategorieId: z.string().min(1, { message: "La catégorie est requise" }),
  description: z.string().optional(),
  invoiceNumber: z.string().optional(),
  date: z.string().optional(),
  payment: z.enum(["ESPECES", "CHEQUES", "MOBILEMONEY", "VIREMENT"] as const).optional(),
  supplierId: z.string().optional(),
});

type ExpenseFormValues = z.infer<typeof expenseSchema>;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const inputClass =
  "w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:bg-gray-50 disabled:text-gray-500";

function formatAmount(amount: number): string {
  return new Intl.NumberFormat("fr-FR").format(amount) + " FCFA";
}

function buildPayload(values: ExpenseFormValues): ExpenseRequest {
  return {
    amount: Number(values.amount),
    expenseCategorieId: values.expenseCategorieId,
    description: values.description || undefined,
    invoiceNumber: values.invoiceNumber || undefined,
    date: values.date || undefined,
    payment: values.payment || undefined,
    supplierId: values.supplierId || undefined,
  };
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function ExpensesPage() {
  const { can } = usePermissions();
  const queryClient = useQueryClient();

  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [selected, setSelected] = useState<Expense | null>(null);

  // Filtres
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [paidFilter, setPaidFilter] = useState("");

  // ---- Queries -------------------------------------------------------------

  const params: Record<string, unknown> = {};
  if (dateFrom) params.dateFrom = dateFrom;
  if (dateTo) params.dateTo = dateTo;
  if (categoryFilter) params.expenseCategorieId = categoryFilter;
  if (paidFilter !== "") params.paid = paidFilter;

  const { data, isLoading } = useQuery({
    queryKey: ["expenses", params],
    queryFn: () => expensesApi.findAll(params).then((r) => r.data),
  });

  const expenses: Expense[] = data?.content ?? [];

  const { data: categoriesData } = useQuery({
    queryKey: ["expense-categories"],
    queryFn: () =>
      apiClient
        .get<PageResponse<ExpenseCategory>>("/expense-categories", {
          params: { size: 200 },
        })
        .then((r) => r.data),
  });

  const categories: ExpenseCategory[] = categoriesData?.content ?? [];
  const categoryOptions = categories.map((c) => ({ value: c.id, label: c.name }));

  function categoryName(id?: string): string {
    return categories.find((c) => c.id === id)?.name ?? "—";
  }

  const { data: suppliersData } = useQuery({
    queryKey: ["suppliers-select"],
    queryFn: () =>
      suppliersApi.findAll({ size: 200 }).then((r) => r.data),
  });

  const supplierOptions =
    suppliersData?.content?.map((s) => ({ value: s.id, label: s.name })) ?? [];

  // ---- Mutations -----------------------------------------------------------

  const createMutation = useMutation({
    mutationFn: (payload: ExpenseRequest) => expensesApi.create(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["expenses"] });
      toast.success("Dépense créée");
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
    mutationFn: ({ id, data }: { id: string; data: ExpenseRequest }) =>
      expensesApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["expenses"] });
      toast.success("Dépense modifiée");
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
    mutationFn: (id: string) => expensesApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["expenses"] });
      toast.success("Dépense supprimée");
      setDeleteOpen(false);
      setSelected(null);
    },
    onError: (err: AxiosError) => {
      const msg =
        (err.response?.data as { message?: string })?.message ??
        "Une erreur est survenue";
      toast.error(msg);
    },
  });

  // ---- Forms ---------------------------------------------------------------

  const createForm = useForm<ExpenseFormValues>({
    resolver: zodResolver(expenseSchema),
    defaultValues: {
      amount: "",
      expenseCategorieId: "",
      description: "",
      invoiceNumber: "",
      date: "",
      payment: undefined,
      supplierId: undefined,
    },
  });

  const editForm = useForm<ExpenseFormValues>({
    resolver: zodResolver(expenseSchema),
  });

  // ---- Handlers ------------------------------------------------------------

  function openEdit(expense: Expense) {
    setSelected(expense);
    editForm.reset({
      amount: String(expense.amount),
      expenseCategorieId: expense.expenseCategorieId ?? "",
      description: expense.description ?? "",
      invoiceNumber: expense.invoiceNumber ?? "",
      date: expense.date ?? "",
      payment: (expense.payment as PaymentMethod) ?? undefined,
      supplierId: expense.supplierId ?? undefined,
    });
    setEditOpen(true);
  }

  function openDelete(expense: Expense) {
    setSelected(expense);
    setDeleteOpen(true);
  }

  function onCreateSubmit(values: ExpenseFormValues) {
    createMutation.mutate(buildPayload(values));
  }

  function onEditSubmit(values: ExpenseFormValues) {
    if (!selected) return;
    updateMutation.mutate({ id: selected.id, data: buildPayload(values) });
  }

  // ---- Columns -------------------------------------------------------------

  const columns: ColumnDef<Expense>[] = [
    {
      header: "Description",
      accessorKey: "description",
      cell: ({ row }) => row.original.description ?? "—",
    },
    {
      header: "Catégorie",
      id: "category",
      cell: ({ row }) => categoryName(row.original.expenseCategorieId),
    },
    {
      header: "Montant (FCFA)",
      accessorKey: "amount",
      cell: ({ row }) => formatAmount(row.original.amount),
    },
    {
      header: "Date",
      accessorKey: "date",
      cell: ({ row }) =>
        row.original.date
          ? new Date(row.original.date).toLocaleDateString("fr-FR")
          : "—",
    },
    {
      header: "N° facture",
      accessorKey: "invoiceNumber",
      cell: ({ row }) => row.original.invoiceNumber ?? "—",
    },
    {
      header: "Paiement",
      accessorKey: "payment",
      cell: ({ row }) => paymentLabel(row.original.payment),
    },
    {
      header: "Statut",
      accessorKey: "paid",
      cell: ({ row }) => (
        <span
          className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${
            row.original.paid >= 1
              ? "bg-green-50 text-green-700 ring-green-600/20"
              : "bg-yellow-50 text-yellow-700 ring-yellow-600/20"
          }`}
        >
          {paidLabel(row.original.paid)}
        </span>
      ),
    },
    {
      header: "Actions",
      id: "actions",
      cell: ({ row }) => (
        <div className="flex items-center gap-2">
          <PermissionGate permission={PERMISSIONS.EDIT_EXPENSES}>
            <button
              onClick={() => openEdit(row.original)}
              className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs font-medium bg-blue-50 text-blue-700 hover:bg-blue-100 transition-colors"
              aria-label="Modifier"
            >
              <Pencil className="h-3.5 w-3.5" />
              Modifier
            </button>
          </PermissionGate>
          <PermissionGate permission={PERMISSIONS.DELETE_EXPENSES}>
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

  // ---- Guard ---------------------------------------------------------------

  if (!can(PERMISSIONS.VIEW_EXPENSES)) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-gray-500">Accès non autorisé</p>
      </div>
    );
  }

  // ---- Render --------------------------------------------------------------

  return (
    <div className="space-y-6">
      <PageHeader
        title="Dépenses"
        action={
          can(PERMISSIONS.CREATE_EXPENSES) ? (
            <button
              onClick={() => {
                createForm.reset();
                setCreateOpen(true);
              }}
              className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
            >
              Ajouter
            </button>
          ) : undefined
        }
      />

      {/* Filtres */}
      <div className="rounded-xl border border-gray-200 bg-white shadow-sm p-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <input
            type="date"
            placeholder="Date début"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className={inputClass}
            title="Date début"
          />
          <input
            type="date"
            placeholder="Date fin"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className={inputClass}
            title="Date fin"
          />
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className={inputClass}
          >
            <option value="">Toutes les catégories</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
          <select
            value={paidFilter}
            onChange={(e) => setPaidFilter(e.target.value)}
            className={inputClass}
          >
            <option value="">Tous les statuts</option>
            <option value="0">Non payé</option>
            <option value="1">Payé</option>
            <option value="2">Payé + stock</option>
          </select>
        </div>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white shadow-sm p-5">
        <DataTable columns={columns} data={expenses} isLoading={isLoading} />
      </div>

      {/* Modal création */}
      <CrudModal
        isOpen={createOpen}
        onClose={() => setCreateOpen(false)}
        title="Ajouter une dépense"
        size="lg"
        onSubmit={createForm.handleSubmit(onCreateSubmit)}
        submitLabel="Ajouter"
        isSubmitting={createMutation.isPending}
      >
        <ExpenseForm form={createForm} categoryOptions={categoryOptions} supplierOptions={supplierOptions} />
      </CrudModal>

      {/* Modal édition */}
      <CrudModal
        isOpen={editOpen}
        onClose={() => setEditOpen(false)}
        title="Modifier la dépense"
        size="lg"
        onSubmit={editForm.handleSubmit(onEditSubmit)}
        submitLabel="Modifier"
        isSubmitting={updateMutation.isPending}
      >
        <ExpenseForm form={editForm} categoryOptions={categoryOptions} supplierOptions={supplierOptions} />
      </CrudModal>

      {/* Modal suppression */}
      <ConfirmModal
        isOpen={deleteOpen}
        onClose={() => {
          setDeleteOpen(false);
          setSelected(null);
        }}
        onConfirm={() => {
          if (selected) deleteMutation.mutate(selected.id);
        }}
        title="Supprimer cette dépense"
        message={`Voulez-vous vraiment supprimer cette dépense ? Cette action est irréversible.`}
        confirmLabel="Supprimer"
        confirmVariant="danger"
        isLoading={deleteMutation.isPending}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// ExpenseForm
// ---------------------------------------------------------------------------

interface CategoryOption {
  value: string;
  label: string;
}

interface SupplierOption {
  value: string;
  label: string;
}

interface ExpenseFormProps {
  form: UseFormReturn<ExpenseFormValues>;
  categoryOptions: CategoryOption[];
  supplierOptions: SupplierOption[];
}

function ExpenseForm({ form, categoryOptions, supplierOptions }: ExpenseFormProps) {
  const {
    register,
    control,
    formState: { errors },
  } = form;

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <FormField label="Montant (FCFA)" required error={errors.amount?.message}>
        <input
          type="number"
          {...register("amount")}
          placeholder="0"
          min={0.01}
          step="0.01"
          className={inputClass}
        />
      </FormField>

      <FormField label="Catégorie" required error={errors.expenseCategorieId?.message}>
        <Controller
          name="expenseCategorieId"
          control={control}
          render={({ field }) => (
            <ReactSelect
              options={categoryOptions}
              value={categoryOptions.find((o) => o.value === field.value) ?? null}
              onChange={(opt) => field.onChange(opt?.value ?? "")}
              placeholder="Sélectionner une catégorie..."
              isClearable
              classNamePrefix="react-select"
            />
          )}
        />
      </FormField>

      <FormField label="Fournisseur" error={errors.supplierId?.message} className="sm:col-span-2">
        <Controller
          name="supplierId"
          control={control}
          render={({ field }) => (
            <ReactSelect<SupplierOption>
              options={supplierOptions}
              value={supplierOptions.find((o) => o.value === field.value) ?? null}
              onChange={(opt) => field.onChange(opt?.value ?? undefined)}
              placeholder="Sélectionner un fournisseur (optionnel)..."
              isClearable
              classNamePrefix="react-select"
              noOptionsMessage={() => "Aucun fournisseur trouvé"}
            />
          )}
        />
      </FormField>

      <FormField label="Description" error={errors.description?.message} className="sm:col-span-2">
        <input
          type="text"
          {...register("description")}
          placeholder="Objet de la dépense"
          className={inputClass}
        />
      </FormField>

      <FormField label="N° facture" error={errors.invoiceNumber?.message}>
        <input
          type="text"
          {...register("invoiceNumber")}
          placeholder="Ex : FAC-2024-001"
          className={inputClass}
        />
      </FormField>

      <FormField label="Date" error={errors.date?.message}>
        <input type="date" {...register("date")} className={inputClass} />
      </FormField>

      <FormField label="Mode de paiement" error={errors.payment?.message} className="sm:col-span-2">
        <select {...register("payment")} className={inputClass}>
          <option value="">Sélectionner un mode...</option>
          {PAYMENT_OPTIONS.map((p) => (
            <option key={p.value} value={p.value}>
              {p.label}
            </option>
          ))}
        </select>
      </FormField>
    </div>
  );
}
