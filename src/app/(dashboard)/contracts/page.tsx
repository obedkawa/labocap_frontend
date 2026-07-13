"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Pencil, Trash2, CheckCircle, XCircle, Eye } from "lucide-react";
import Link from "next/link";
import Select from "react-select";
import type { ColumnDef } from "@tanstack/react-table";
import type { AxiosError } from "axios";
import type { UseFormReturn } from "react-hook-form";
import type { SingleValue } from "react-select";

import { PageHeader } from "@/components/ui/PageHeader";
import { RHFSelect } from "@/components/ui/RHFSelect";
import { NativeSelect } from "@/components/ui/NativeSelect";
import { DataTable } from "@/components/common/DataTable";
import { CrudModal } from "@/components/common/CrudModal";
import { ConfirmModal } from "@/components/common/ConfirmModal";
import { PermissionGate } from "@/components/common/PermissionGate";
import { FormField } from "@/components/ui/FormField";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { usePermissions } from "@/hooks/usePermissions";
import { PERMISSIONS } from "@/lib/constants/permissions";
import {
  contractsApi,
  Contract,
  ContractRequest,
  ContractStatus,
} from "@/lib/api/contracts";
import { clientsApi } from "@/lib/api/clients";

// ---------------------------------------------------------------------------
// Constantes
// ---------------------------------------------------------------------------

const CONTRACT_STATUSES: { value: ContractStatus; label: string }[] = [
  { value: "ACTIF", label: "Actif" },
  { value: "INACTIF", label: "Inactif" },
  { value: "CLOTURE", label: "Clôturé" },
];

const CONTRACT_TYPES = [
  { value: "HOSPITAL", label: "Hôpital" },
  { value: "CLINIQUE", label: "Clinique" },
  { value: "ENTREPRISE", label: "Entreprise" },
  { value: "AUTRE", label: "Autre" },
];

// ---------------------------------------------------------------------------
// Zod schema — aligné sur ContratRequestDto
// ---------------------------------------------------------------------------

const contractSchema = z.object({
  name: z.string().optional(),
  type: z.string().optional(),
  description: z.string().optional(),
  clientId: z.string().optional(),
  startDate: z.string().min(1, { message: "La date de début est requise" }),
  endDate: z.string().optional(),
  nbrTests: z.string().optional(),
  status: z.enum(["ACTIF", "INACTIF", "CLOTURE"] as const).optional(),
  invoiceUnique: z.boolean().optional(),
});

type ContractFormValues = z.infer<typeof contractSchema>;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const inputClass =
  "w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:bg-gray-50 disabled:text-gray-500";

function buildPayload(values: ContractFormValues): ContractRequest {
  return {
    name: values.name || undefined,
    type: values.type || undefined,
    description: values.description || undefined,
    clientId: values.clientId || undefined,
    startDate: values.startDate,
    endDate: values.endDate || undefined,
    nbrTests:
      values.nbrTests === "" || values.nbrTests === undefined
        ? undefined
        : Number(values.nbrTests),
    status: values.status,
    invoiceUnique: values.invoiceUnique,
  };
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function ContractsPage() {
  const { can } = usePermissions();
  const queryClient = useQueryClient();

  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [selected, setSelected] = useState<Contract | null>(null);

  // Filtres
  const [statusFilter, setStatusFilter] = useState("");
  const [clientSearch, setClientSearch] = useState("");
  const [nameSearch, setNameSearch] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  // ---- Queries -------------------------------------------------------------

  const params: Record<string, unknown> = {};
  if (statusFilter) params.status = statusFilter;
  if (clientSearch) params.clientSearch = clientSearch;
  if (nameSearch) params.search = nameSearch;
  if (dateFrom) params.dateFrom = dateFrom;
  if (dateTo) params.dateTo = dateTo;

  const { data, isLoading } = useQuery({
    queryKey: ["contracts", params],
    queryFn: () => contractsApi.findAll(params).then((r) => r.data),
  });

  const contracts: Contract[] = data?.content ?? [];

  // Clients pour le React Select (live search)
  const [clientInputValue, setClientInputValue] = useState("");

  const { data: clientsData } = useQuery({
    queryKey: ["clients-search", clientInputValue],
    queryFn: () =>
      clientsApi
        .findAll({ size: 50, ...(clientInputValue ? { search: clientInputValue } : {}) })
        .then((r) => r.data),
  });

  const clientOptions =
    clientsData?.content?.map((c) => ({ value: c.id, label: c.name })) ?? [];

  // ---- Mutations -----------------------------------------------------------

  const createMutation = useMutation({
    mutationFn: (payload: ContractRequest) => contractsApi.create(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["contracts"] });
      toast.success("Contrat créé");
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
    mutationFn: ({ id, data }: { id: string; data: ContractRequest }) =>
      contractsApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["contracts"] });
      toast.success("Contrat modifié");
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
    mutationFn: (id: string) => contractsApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["contracts"] });
      toast.success("Contrat supprimé");
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

  const activateMutation = useMutation({
    mutationFn: (id: string) => contractsApi.activate(id),
    onSuccess: () => {
      toast.success("Contrat activé");
      queryClient.invalidateQueries({ queryKey: ["contracts"] });
    },
    onError: () => toast.error("Erreur lors de l'activation"),
  });

  const closeMutation = useMutation({
    mutationFn: (id: string) => contractsApi.close(id),
    onSuccess: () => {
      toast.success("Contrat clôturé");
      queryClient.invalidateQueries({ queryKey: ["contracts"] });
    },
    onError: () => toast.error("Erreur lors de la clôture"),
  });

  // ---- Forms ---------------------------------------------------------------

  const createForm = useForm<ContractFormValues>({
    resolver: zodResolver(contractSchema),
    defaultValues: {
      name: "",
      type: "",
      description: "",
      clientId: "",
      startDate: "",
      endDate: "",
      nbrTests: "",
      status: "INACTIF",
      invoiceUnique: true,
    },
  });

  const editForm = useForm<ContractFormValues>({
    resolver: zodResolver(contractSchema),
  });

  // ---- Handlers ------------------------------------------------------------

  function openEdit(contract: Contract) {
    setSelected(contract);
    editForm.reset({
      name: contract.name ?? "",
      type: contract.type ?? "",
      description: contract.description ?? "",
      clientId: contract.clientId ?? "",
      startDate: contract.startDate,
      endDate: contract.endDate ?? "",
      nbrTests: contract.nbrTests != null ? String(contract.nbrTests) : "",
      status: contract.status,
      invoiceUnique: contract.invoiceUnique ?? true,
    });
    setEditOpen(true);
  }

  function openDelete(contract: Contract) {
    setSelected(contract);
    setDeleteOpen(true);
  }

  function onCreateSubmit(values: ContractFormValues) {
    createMutation.mutate(buildPayload(values));
  }

  function onEditSubmit(values: ContractFormValues) {
    if (!selected) return;
    updateMutation.mutate({ id: selected.id, data: buildPayload(values) });
  }

  // ---- Columns -------------------------------------------------------------

  const columns: ColumnDef<Contract>[] = [
    {
      header: "Nom",
      accessorKey: "name",
      cell: ({ row }) => row.original.name ?? "—",
    },
    {
      header: "Client",
      id: "client",
      cell: ({ row }) => row.original.clientName ?? "—",
    },
    {
      header: "Type",
      accessorKey: "type",
      cell: ({ row }) => row.original.type ?? "—",
    },
    {
      header: "Date début",
      accessorKey: "startDate",
      cell: ({ row }) =>
        row.original.startDate
          ? new Date(row.original.startDate).toLocaleDateString("fr-FR")
          : "—",
    },
    {
      header: "Date fin",
      accessorKey: "endDate",
      cell: ({ row }) =>
        row.original.endDate
          ? new Date(row.original.endDate).toLocaleDateString("fr-FR")
          : "—",
    },
    {
      header: "Statut",
      accessorKey: "status",
      cell: ({ row }) => (
        <StatusBadge status={row.original.status} domain="contract" />
      ),
    },
    {
      header: "Actions",
      id: "actions",
      cell: ({ row }) => (
        <div className="flex items-center gap-2">
          <Link
            href={`/contracts/${row.original.id}`}
            className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs font-medium bg-amber-500 text-white hover:bg-amber-600 transition-colors"
          >
            <Eye className="h-3.5 w-3.5" />
            Détail
          </Link>
          <PermissionGate permission={PERMISSIONS.EDIT_CONTRACTS}>
            <button
              onClick={() => openEdit(row.original)}
              className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs font-medium bg-blue-600 text-white hover:bg-blue-700 transition-colors"
              aria-label="Modifier"
            >
              <Pencil className="h-3.5 w-3.5" />
              Modifier
            </button>
          </PermissionGate>
          <PermissionGate permission={PERMISSIONS.EDIT_CONTRACTS}>
            {row.original.status === "INACTIF" && (
              <button
                onClick={() => activateMutation.mutate(row.original.id)}
                disabled={activateMutation.isPending}
                className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs font-medium bg-green-600 text-white hover:bg-green-700 transition-colors disabled:opacity-50"
                aria-label="Activer"
              >
                <CheckCircle className="h-3.5 w-3.5" />
                Activer
              </button>
            )}
            {row.original.status === "ACTIF" && (
              <button
                onClick={() => closeMutation.mutate(row.original.id)}
                disabled={closeMutation.isPending}
                className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs font-medium bg-gray-600 text-white hover:bg-gray-700 transition-colors disabled:opacity-50"
                aria-label="Clôturer"
              >
                <XCircle className="h-3.5 w-3.5" />
                Clôturer
              </button>
            )}
          </PermissionGate>
          <PermissionGate permission={PERMISSIONS.DELETE_CONTRACTS}>
            <button
              onClick={() => openDelete(row.original)}
              className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs font-medium bg-red-600 text-white hover:bg-red-700 transition-colors"
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

  if (!can(PERMISSIONS.VIEW_CONTRACTS)) {
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
        title="Contrats"
        action={
          can(PERMISSIONS.CREATE_CONTRACTS) ? (
            <button
              onClick={() => {
                createForm.reset();
                setCreateOpen(true);
              }}
              className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
            >
              Ajouter un contrat
            </button>
          ) : undefined
        }
      />

      {/* Filtres */}
      <div className="rounded-xl border border-gray-200 bg-white shadow-sm p-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <NativeSelect
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="">Tous les statuts</option>
            {CONTRACT_STATUSES.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </NativeSelect>
          <input
            type="text"
            placeholder="Rechercher par nom de contrat..."
            value={nameSearch}
            onChange={(e) => setNameSearch(e.target.value)}
            className={inputClass}
          />
          <input
            type="text"
            placeholder="Rechercher par client..."
            value={clientSearch}
            onChange={(e) => setClientSearch(e.target.value)}
            className={inputClass}
          />
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className={inputClass}
            title="Date début"
          />
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className={inputClass}
            title="Date fin"
          />
        </div>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white shadow-sm p-5">
        <DataTable columns={columns} data={contracts} isLoading={isLoading} />
      </div>

      {/* Modal création */}
      <CrudModal
        isOpen={createOpen}
        onClose={() => setCreateOpen(false)}
        title="Ajouter un nouveau contrat"
        size="lg"
        onSubmit={createForm.handleSubmit(onCreateSubmit)}
        submitLabel="Ajouter un contrat"
        isSubmitting={createMutation.isPending}
      >
        <ContractForm
          form={createForm}
          clientOptions={clientOptions}
          onClientInputChange={setClientInputValue}
        />
      </CrudModal>

      {/* Modal édition */}
      <CrudModal
        isOpen={editOpen}
        onClose={() => setEditOpen(false)}
        title="Modifier le contrat"
        size="lg"
        onSubmit={editForm.handleSubmit(onEditSubmit)}
        submitLabel="Modifier"
        isSubmitting={updateMutation.isPending}
      >
        <ContractForm
          form={editForm}
          clientOptions={clientOptions}
          onClientInputChange={setClientInputValue}
        />
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
        title="Supprimer ce contrat"
        message={`Voulez-vous vraiment supprimer le contrat "${selected?.name ?? ""}" ? Cette action est irréversible.`}
        confirmLabel="Supprimer"
        confirmVariant="danger"
        isLoading={deleteMutation.isPending}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// ContractForm
// ---------------------------------------------------------------------------

interface SelectOption {
  value: string;
  label: string;
}

interface ContractFormProps {
  form: UseFormReturn<ContractFormValues>;
  clientOptions: SelectOption[];
  onClientInputChange: (value: string) => void;
}

function ContractForm({
  form,
  clientOptions,
  onClientInputChange,
}: ContractFormProps) {
  const {
    register,
    control,
    watch,
    setValue,
    formState: { errors },
  } = form;

  const invoiceUnique = watch("invoiceUnique");

  return (
    <div className="grid grid-cols-1 gap-4">
      <FormField label="Nom du contrat" error={errors.name?.message} className="sm:col-span-2">
        <input
          type="text"
          {...register("name")}
          placeholder="Nom du contrat"
          className={inputClass}
        />
      </FormField>

      <FormField label="Client" error={errors.clientId?.message} className="sm:col-span-2">
        <Controller
          name="clientId"
          control={control}
          render={({ field }) => (
            <Select<SelectOption>
              instanceId="contract-client"
              inputId="clientId"
              options={clientOptions}
              value={
                clientOptions.find((o) => o.value === field.value) ?? null
              }
              onChange={(option: SingleValue<SelectOption>) =>
                field.onChange(option?.value ?? "")
              }
              onInputChange={onClientInputChange}
              placeholder="Rechercher un client..."
              isClearable
              noOptionsMessage={() => "Aucun client trouvé"}
              classNamePrefix="react-select"
              styles={{
                control: (base, state) => ({
                  ...base,
                  minHeight: "38px",
                  borderRadius: "0.375rem",
                  borderColor: errors.clientId
                    ? "#fca5a5"
                    : state.isFocused
                    ? "#3b82f6"
                    : "#d1d5db",
                  boxShadow: state.isFocused
                    ? "0 0 0 1px #3b82f6"
                    : "none",
                  fontSize: "0.875rem",
                }),
                option: (base, state) => ({
                  ...base,
                  fontSize: "0.875rem",
                  backgroundColor: state.isSelected
                    ? "#2563eb"
                    : state.isFocused
                    ? "#eff6ff"
                    : "white",
                  color: state.isSelected ? "white" : "#374151",
                }),
                placeholder: (base) => ({
                  ...base,
                  color: "#9ca3af",
                  fontSize: "0.875rem",
                }),
                singleValue: (base) => ({
                  ...base,
                  fontSize: "0.875rem",
                }),
                menu: (base) => ({
                  ...base,
                  zIndex: 50,
                }),
              }}
            />
          )}
        />
      </FormField>

      <RHFSelect
        control={control}
        name="type"
        label="Type"
        options={CONTRACT_TYPES}
        placeholder="Sélectionner un type..."
        error={errors.type?.message}
        isClearable
      />

      <FormField label="Nombre de tests" error={errors.nbrTests?.message}>
        <input
          type="number"
          {...register("nbrTests")}
          placeholder="0"
          min={0}
          className={inputClass}
        />
      </FormField>

      <FormField
        label="Date de début"
        required
        error={errors.startDate?.message}
      >
        <input
          type="date"
          {...register("startDate")}
          className={inputClass}
        />
      </FormField>

      <FormField label="Date de fin" error={errors.endDate?.message}>
        <input type="date" {...register("endDate")} className={inputClass} />
      </FormField>

      <RHFSelect
        control={control}
        name="status"
        label="Statut"
        options={CONTRACT_STATUSES}
        placeholder="Sélectionner un statut..."
        error={errors.status?.message}
      />

      <FormField label="Facturation unique" error={errors.invoiceUnique?.message}>
        <button
          type="button"
          onClick={() => setValue("invoiceUnique", !invoiceUnique)}
          className={`inline-flex items-center gap-2 rounded px-3 py-2 text-sm font-medium border transition-colors ${
            invoiceUnique
              ? "bg-blue-50 text-blue-700 border-blue-300"
              : "bg-gray-50 text-gray-600 border-gray-300"
          }`}
        >
          {invoiceUnique ? "Oui" : "Non"}
        </button>
      </FormField>

      <div className="sm:col-span-2">
        <FormField label="Description" error={errors.description?.message}>
          <textarea
            {...register("description")}
            placeholder="Description du contrat..."
            rows={3}
            className={inputClass}
          />
        </FormField>
      </div>
    </div>
  );
}
