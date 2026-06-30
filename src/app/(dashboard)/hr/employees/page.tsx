"use client";

import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Pencil, Trash2, Eye } from "lucide-react";
import type { ColumnDef } from "@tanstack/react-table";
import type { AxiosError } from "axios";
import type { UseFormReturn } from "react-hook-form";

import Link from "next/link";
import { PageHeader } from "@/components/ui/PageHeader";
import { DataTable } from "@/components/common/DataTable";
import { CrudModal } from "@/components/common/CrudModal";
import { ConfirmModal } from "@/components/common/ConfirmModal";
import { PermissionGate } from "@/components/common/PermissionGate";
import { FormField } from "@/components/ui/FormField";
import { usePermissions } from "@/hooks/usePermissions";
import { PERMISSIONS } from "@/lib/constants/permissions";
import { hrApi, Employee, EmployeeRequest } from "@/lib/api/hr";

// ---------------------------------------------------------------------------
// Zod schema — aligné sur EmployeeRequestDto (firstName, lastName obligatoires)
// ---------------------------------------------------------------------------

const employeeSchema = z.object({
  firstName: z.string().min(1, "Le prénom est requis"),
  lastName: z.string().min(1, "Le nom est requis"),
  position: z.string().optional(),
  salary: z.string().optional(),
  hireDate: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email("Email invalide").optional().or(z.literal("")),
});

type EmployeeFormValues = z.infer<typeof employeeSchema>;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const inputClass =
  "w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:bg-gray-50 disabled:text-gray-500";

function formatSalary(amount?: number): string {
  if (amount == null) return "—";
  return new Intl.NumberFormat("fr-FR").format(amount) + " FCFA";
}

function buildPayload(values: EmployeeFormValues): EmployeeRequest {
  return {
    firstName: values.firstName,
    lastName: values.lastName,
    position: values.position || undefined,
    salary:
      values.salary === "" || values.salary === undefined
        ? undefined
        : Number(values.salary),
    hireDate: values.hireDate || undefined,
    phone: values.phone || undefined,
    email: values.email || undefined,
  };
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function EmployeesPage() {
  const { can } = usePermissions();
  const queryClient = useQueryClient();

  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);

  // Filtre
  const [search, setSearch] = useState("");

  // ---- Queries & Mutations ------------------------------------------------

  const { data, isLoading } = useQuery({
    queryKey: ["employees"],
    // size élevé : la recherche filtre côté client sur l'ensemble des employés.
    queryFn: () => hrApi.findAll({ size: 1000 }).then((r) => r.data),
  });

  const employees: Employee[] = data?.content ?? [];

  // Employés filtrés (filtrage local)
  const filtered = useMemo(() => {
    return employees.filter((e) => {
      const fullName = `${e.firstName} ${e.lastName}`.toLowerCase();
      return !search || fullName.includes(search.toLowerCase());
    });
  }, [employees, search]);

  const createMutation = useMutation({
    mutationFn: (payload: EmployeeRequest) => hrApi.create(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["employees"] });
      toast.success("Employé créé");
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
    mutationFn: ({ id, data }: { id: string; data: EmployeeRequest }) =>
      hrApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["employees"] });
      toast.success("Employé modifié");
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
    mutationFn: (id: string) => hrApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["employees"] });
      toast.success("Employé supprimé");
      setDeleteOpen(false);
      setSelectedEmployee(null);
    },
    onError: (err: AxiosError) => {
      const msg =
        (err.response?.data as { message?: string })?.message ??
        "Une erreur est survenue";
      toast.error(msg);
    },
  });

  // ---- Forms ---------------------------------------------------------------

  const createForm = useForm<EmployeeFormValues>({
    resolver: zodResolver(employeeSchema),
    defaultValues: {
      firstName: "",
      lastName: "",
      position: "",
      salary: "",
      hireDate: "",
      phone: "",
      email: "",
    },
  });

  const editForm = useForm<EmployeeFormValues>({
    resolver: zodResolver(employeeSchema),
  });

  // ---- Handlers ------------------------------------------------------------

  function openEdit(employee: Employee) {
    setSelectedEmployee(employee);
    editForm.reset({
      firstName: employee.firstName,
      lastName: employee.lastName,
      position: employee.position ?? "",
      salary: employee.salary != null ? String(employee.salary) : "",
      hireDate: employee.hireDate ?? "",
      phone: employee.phone ?? "",
      email: employee.email ?? "",
    });
    setEditOpen(true);
  }

  function openDelete(employee: Employee) {
    setSelectedEmployee(employee);
    setDeleteOpen(true);
  }

  function onCreateSubmit(values: EmployeeFormValues) {
    createMutation.mutate(buildPayload(values));
  }

  function onEditSubmit(values: EmployeeFormValues) {
    if (!selectedEmployee) return;
    updateMutation.mutate({ id: selectedEmployee.id, data: buildPayload(values) });
  }

  // ---- Columns -------------------------------------------------------------

  const columns: ColumnDef<Employee>[] = [
    {
      header: "Nom & Prénom",
      id: "fullname",
      cell: ({ row }) => (
        <span className="font-medium text-gray-900">
          {row.original.lastName} {row.original.firstName}
        </span>
      ),
    },
    {
      header: "Poste",
      accessorKey: "position",
      cell: ({ row }) => row.original.position ?? "—",
    },
    {
      header: "Salaire",
      accessorKey: "salary",
      cell: ({ row }) => formatSalary(row.original.salary),
    },
    {
      header: "Date embauche",
      accessorKey: "hireDate",
      cell: ({ row }) =>
        row.original.hireDate
          ? new Date(row.original.hireDate).toLocaleDateString("fr-FR")
          : "—",
    },
    {
      header: "Téléphone",
      accessorKey: "phone",
      cell: ({ row }) => row.original.phone ?? "—",
    },
    {
      header: "Actions",
      id: "actions",
      cell: ({ row }) => (
        <div className="flex items-center gap-2">
          <Link
            href={`/hr/employees/${row.original.id}`}
            className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs font-medium bg-gray-50 text-gray-700 hover:bg-gray-100 transition-colors"
            title="Voir le profil"
          >
            <Eye className="h-3.5 w-3.5" />
            Profil
          </Link>
          <PermissionGate permission={PERMISSIONS.EDIT_EMPLOYEES}>
            <button
              onClick={() => openEdit(row.original)}
              className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs font-medium bg-blue-50 text-blue-700 hover:bg-blue-100 transition-colors"
              aria-label="Modifier"
            >
              <Pencil className="h-3.5 w-3.5" />
              Modifier
            </button>
          </PermissionGate>
          <PermissionGate permission={PERMISSIONS.DELETE_EMPLOYEES}>
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

  // ---- Render --------------------------------------------------------------

  return (
    <div className="space-y-6">
      <PageHeader
        title="Employés"
        action={
          can(PERMISSIONS.CREATE_EMPLOYEES) ? (
            <button
              onClick={() => {
                createForm.reset();
                setCreateOpen(true);
              }}
              className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
            >
              Ajouter un employé
            </button>
          ) : undefined
        }
      />

      {/* Filtre */}
      <div className="flex flex-wrap gap-3 rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
        <input
          type="text"
          placeholder="Rechercher un employé..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full max-w-xs rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
      </div>

      <div className="rounded-xl border border-gray-200 bg-white shadow-sm p-5">
        <DataTable columns={columns} data={filtered} isLoading={isLoading} />
      </div>

      {/* ---- Modal création ---- */}
      <CrudModal
        isOpen={createOpen}
        onClose={() => setCreateOpen(false)}
        title="Ajouter un employé"
        size="xl"
        onSubmit={createForm.handleSubmit(onCreateSubmit)}
        submitLabel="Ajouter un employé"
        isSubmitting={createMutation.isPending}
      >
        <EmployeeForm form={createForm} />
      </CrudModal>

      {/* ---- Modal édition ---- */}
      <CrudModal
        isOpen={editOpen}
        onClose={() => setEditOpen(false)}
        title="Modifier un employé"
        size="xl"
        onSubmit={editForm.handleSubmit(onEditSubmit)}
        submitLabel="Modifier"
        isSubmitting={updateMutation.isPending}
      >
        <EmployeeForm form={editForm} />
      </CrudModal>

      {/* ---- Modal confirmation suppression ---- */}
      <ConfirmModal
        isOpen={deleteOpen}
        onClose={() => {
          setDeleteOpen(false);
          setSelectedEmployee(null);
        }}
        onConfirm={() => {
          if (selectedEmployee) deleteMutation.mutate(selectedEmployee.id);
        }}
        title="Supprimer cet employé"
        message={`Voulez-vous vraiment supprimer l'employé "${selectedEmployee?.firstName ?? ""} ${selectedEmployee?.lastName ?? ""}" ? Cette action est irréversible.`}
        confirmLabel="Supprimer"
        confirmVariant="danger"
        isLoading={deleteMutation.isPending}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// EmployeeForm — formulaire partagé création / édition
// ---------------------------------------------------------------------------

interface EmployeeFormProps {
  form: UseFormReturn<EmployeeFormValues>;
}

function EmployeeForm({ form }: EmployeeFormProps) {
  const {
    register,
    formState: { errors },
  } = form;

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <FormField label="Prénom" required error={errors.firstName?.message}>
        <input
          type="text"
          {...register("firstName")}
          placeholder="Prénom de l'employé"
          className={inputClass}
        />
      </FormField>

      <FormField label="Nom" required error={errors.lastName?.message}>
        <input
          type="text"
          {...register("lastName")}
          placeholder="Nom de l'employé"
          className={inputClass}
        />
      </FormField>

      <FormField label="Poste" error={errors.position?.message}>
        <input
          type="text"
          {...register("position")}
          placeholder="Ex : Technicien de laboratoire"
          className={inputClass}
        />
      </FormField>

      <FormField label="Salaire (FCFA)" error={errors.salary?.message}>
        <input
          type="number"
          {...register("salary")}
          placeholder="Ex : 150000"
          min={0}
          className={inputClass}
        />
      </FormField>

      <FormField label="Date d'embauche" error={errors.hireDate?.message}>
        <input
          type="date"
          {...register("hireDate")}
          className={inputClass}
        />
      </FormField>

      <FormField label="Téléphone" error={errors.phone?.message}>
        <input
          type="tel"
          {...register("phone")}
          placeholder="97000000"
          className={inputClass}
        />
      </FormField>

      <FormField label="Email" error={errors.email?.message} className="sm:col-span-2">
        <input
          type="email"
          {...register("email")}
          placeholder="exemple@domaine.com"
          className={inputClass}
        />
      </FormField>
    </div>
  );
}
