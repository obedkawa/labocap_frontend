"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm, type UseFormRegister, type FieldErrors } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import Link from "next/link";
import { Eye, Pencil, Trash2, Plus, Search } from "lucide-react";
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
import { patientsApi, Patient, PatientRequest } from "@/lib/api/patients";
import type { PageResponse, ApiError } from "@/types/api";

// ---------------------------------------------------------------------------
// Zod schema
// ---------------------------------------------------------------------------

const patientSchema = z.object({
  lastname: z.string().min(1, "Le nom est requis"),
  firstname: z.string().min(1, "Le prénom est requis"),
  genre: z.string().min(1, "Le genre est requis"),
  langue: z.string().min(1, "La langue est requise"),
  birthday: z.string().optional(),
  age: z.string().min(1, "L'âge est requis"),
  yearOrMonth: z.string().min(1, "L'unité d'âge est requise"),
  profession: z.string().optional(),
  telephone1: z.string().min(1, "Le contact 1 est requis"),
  telephone2: z.string().optional(),
  adresse: z.string().min(1, "L'adresse est requise"),
  email: z.string().optional(),
});

type PatientFormData = z.infer<typeof patientSchema>;

// ---------------------------------------------------------------------------
// Form fields component (shared by create & edit modals)
// ---------------------------------------------------------------------------

interface PatientFormFieldsProps {
  register: UseFormRegister<PatientFormData>;
  errors: FieldErrors<PatientFormData>;
}

function PatientFormFields({ register, errors }: PatientFormFieldsProps) {
  return (
    <div className="grid grid-cols-2 gap-4">
      {/* 1. Code (readonly) */}
      <div className="flex flex-col gap-1">
        <label className="text-sm font-medium text-gray-700">Code</label>
        <input
          type="text"
          value="Auto"
          readOnly
          className="rounded-md border border-gray-200 bg-gray-100 px-3 py-2 text-sm text-gray-400 cursor-not-allowed"
        />
      </div>

      {/* 2. Nom */}
      <div className="flex flex-col gap-1">
        <label className="text-sm font-medium text-gray-700">
          Nom <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          {...register("lastname")}
          className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
        {errors.lastname && (
          <p className="text-xs text-red-500">{errors.lastname.message}</p>
        )}
      </div>

      {/* 3. Prénom */}
      <div className="flex flex-col gap-1">
        <label className="text-sm font-medium text-gray-700">
          Prénom <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          {...register("firstname")}
          className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
        {errors.firstname && (
          <p className="text-xs text-red-500">{errors.firstname.message}</p>
        )}
      </div>

      {/* 4. Genre */}
      <div className="flex flex-col gap-1">
        <label className="text-sm font-medium text-gray-700">
          Genre <span className="text-red-500">*</span>
        </label>
        <select
          {...register("genre")}
          className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        >
          <option value="">-- Sélectionner --</option>
          <option value="M">Masculin</option>
          <option value="F">Féminin</option>
        </select>
        {errors.genre && (
          <p className="text-xs text-red-500">{errors.genre.message}</p>
        )}
      </div>

      {/* 5. Langue */}
      <div className="flex flex-col gap-1">
        <label className="text-sm font-medium text-gray-700">
          Langue <span className="text-red-500">*</span>
        </label>
        <select
          {...register("langue")}
          className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        >
          <option value="">-- Sélectionner --</option>
          <option value="français">Français</option>
          <option value="fon">Fon</option>
          <option value="anglais">Anglais</option>
        </select>
        {errors.langue && (
          <p className="text-xs text-red-500">{errors.langue.message}</p>
        )}
      </div>

      {/* 6. Date de naissance */}
      <div className="flex flex-col gap-1">
        <label className="text-sm font-medium text-gray-700">
          Date de naissance
        </label>
        <input
          type="date"
          {...register("birthday")}
          className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
      </div>

      {/* 7. Âge */}
      <div className="flex flex-col gap-1">
        <label className="text-sm font-medium text-gray-700">
          Âge <span className="text-red-500">*</span>
        </label>
        <input
          type="number"
          min={0}
          {...register("age")}
          className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
        {errors.age && (
          <p className="text-xs text-red-500">{errors.age.message}</p>
        )}
      </div>

      {/* 8. Mois ou Années */}
      <div className="flex flex-col gap-1">
        <label className="text-sm font-medium text-gray-700">
          Mois ou Années <span className="text-red-500">*</span>
        </label>
        <select
          {...register("yearOrMonth")}
          className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        >
          <option value="">-- Sélectionner --</option>
          <option value="false">Mois</option>
          <option value="true">Ans</option>
        </select>
        {errors.yearOrMonth && (
          <p className="text-xs text-red-500">{errors.yearOrMonth.message}</p>
        )}
      </div>

      {/* 9. Profession */}
      <div className="flex flex-col gap-1">
        <label className="text-sm font-medium text-gray-700">Profession</label>
        <input
          type="text"
          {...register("profession")}
          className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
      </div>

      {/* 10. Téléphone 1 */}
      <div className="flex flex-col gap-1">
        <label className="text-sm font-medium text-gray-700">
          Téléphone 1 <span className="text-red-500">*</span>
        </label>
        <input
          type="tel"
          placeholder="97000000"
          {...register("telephone1")}
          className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
        {errors.telephone1 && (
          <p className="text-xs text-red-500">{errors.telephone1.message}</p>
        )}
      </div>

      {/* 11. Téléphone 2 */}
      <div className="flex flex-col gap-1">
        <label className="text-sm font-medium text-gray-700">Téléphone 2</label>
        <input
          type="tel"
          {...register("telephone2")}
          className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
      </div>

      {/* 12. Email */}
      <div className="flex flex-col gap-1">
        <label className="text-sm font-medium text-gray-700">Email</label>
        <input
          type="email"
          {...register("email")}
          className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
      </div>

      {/* 13. Adresse (col-span-2) */}
      <div className="col-span-2 flex flex-col gap-1">
        <label className="text-sm font-medium text-gray-700">
          Adresse <span className="text-red-500">*</span>
        </label>
        <textarea
          rows={3}
          {...register("adresse")}
          className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 resize-none"
        />
        {errors.adresse && (
          <p className="text-xs text-red-500">{errors.adresse.message}</p>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export default function PatientsPage() {
  const { can } = usePermissions();
  const queryClient = useQueryClient();

  // --- Pagination & search state
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(10);
  const [search, setSearch] = useState("");

  // --- Modal state
  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<Patient | null>(null);

  // --- Create form
  const {
    register: registerCreate,
    handleSubmit: handleSubmitCreate,
    formState: { errors: createErrors },
    reset: resetCreate,
  } = useForm<PatientFormData>({
    resolver: zodResolver(patientSchema),
    defaultValues: {
      yearOrMonth: "true",
    },
  });

  // --- Edit form
  const {
    register: registerEdit,
    handleSubmit: handleSubmitEdit,
    formState: { errors: editErrors },
    reset: resetEdit,
  } = useForm<PatientFormData>({
    resolver: zodResolver(patientSchema),
  });

  // --- Query
  const { data, isLoading } = useQuery<PageResponse<Patient>>({
    queryKey: ["patients", { page, size: pageSize, search }],
    queryFn: () =>
      patientsApi
        .findAll({ page, size: pageSize, search: search || undefined })
        .then((r) => r.data),
  });

  const patients = data?.content ?? [];
  const pageCount = data?.totalPages ?? 0;

  // --- Mutations
  const createMutation = useMutation({
    mutationFn: (data: PatientRequest) => patientsApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["patients"] });
      toast.success("Patient créé avec succès");
      setCreateOpen(false);
      resetCreate();
    },
    onError: (err: AxiosError<ApiError>) => {
      toast.error(err.response?.data?.message ?? "Erreur lors de la création");
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: PatientRequest }) =>
      patientsApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["patients"] });
      toast.success("Patient modifié avec succès");
      setEditOpen(false);
      setSelectedPatient(null);
      resetEdit();
    },
    onError: (err: AxiosError<ApiError>) => {
      toast.error(
        err.response?.data?.message ?? "Erreur lors de la modification"
      );
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => patientsApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["patients"] });
      toast.success("Patient supprimé avec succès");
      setDeleteConfirm(null);
    },
    onError: (err: AxiosError<ApiError>) => {
      toast.error(
        err.response?.data?.message ?? "Erreur lors de la suppression"
      );
    },
  });

  // --- Handlers
  const handleOpenEdit = (patient: Patient) => {
    setSelectedPatient(patient);
    resetEdit({
      lastname: patient.lastname,
      firstname: patient.firstname,
      genre: patient.genre,
      langue: patient.langue,
      birthday: patient.birthday ?? "",
      age: patient.age != null ? String(patient.age) : "",
      yearOrMonth:
        patient.yearOrMonth === undefined
          ? ""
          : patient.yearOrMonth
          ? "true"
          : "false",
      profession: patient.profession ?? "",
      telephone1: patient.telephone1,
      telephone2: patient.telephone2 ?? "",
      adresse: patient.adresse,
      email: patient.email ?? "",
    });
    setEditOpen(true);
  };

  const handleCloseCreate = () => {
    setCreateOpen(false);
    resetCreate();
  };

  const handleCloseEdit = () => {
    setEditOpen(false);
    setSelectedPatient(null);
    resetEdit();
  };

  const onCreateSubmit = (formData: PatientFormData) => {
    const payload: PatientRequest = {
      code: `PAT-${Date.now()}`,
      lastname: formData.lastname,
      firstname: formData.firstname,
      genre: formData.genre,
      langue: formData.langue,
      birthday: formData.birthday || undefined,
      age: Number(formData.age),
      yearOrMonth: formData.yearOrMonth ? formData.yearOrMonth === "true" : undefined,
      profession: formData.profession || undefined,
      telephone1: formData.telephone1,
      telephone2: formData.telephone2 || undefined,
      adresse: formData.adresse,
      email: formData.email || undefined,
    };
    createMutation.mutate(payload);
  };

  const onEditSubmit = (formData: PatientFormData) => {
    if (!selectedPatient) return;
    const payload: PatientRequest = {
      code: selectedPatient.code,
      lastname: formData.lastname,
      firstname: formData.firstname,
      genre: formData.genre,
      langue: formData.langue,
      birthday: formData.birthday || undefined,
      age: Number(formData.age),
      yearOrMonth: formData.yearOrMonth ? formData.yearOrMonth === "true" : undefined,
      profession: formData.profession || undefined,
      telephone1: formData.telephone1,
      telephone2: formData.telephone2 || undefined,
      adresse: formData.adresse,
      email: formData.email || undefined,
    };
    updateMutation.mutate({ id: selectedPatient.id, data: payload });
  };

  // --- Columns
  const columns: ColumnDef<Patient>[] = [
    {
      header: "Code",
      accessorKey: "code",
      enableSorting: true,
      cell: ({ row }) => (
        <span className="font-mono text-xs">{row.original.code ?? "—"}</span>
      ),
    },
    {
      header: "Nom & Prénoms",
      id: "fullname",
      accessorFn: (row) => `${row.lastname ?? ""} ${row.firstname ?? ""}`.trim(),
      enableSorting: true,
      cell: ({ row }) => (
        <span className="font-medium text-gray-900">
          {row.original.lastname} {row.original.firstname}
        </span>
      ),
    },
    {
      header: "Genre",
      accessorKey: "genre",
      enableSorting: true,
      cell: ({ row }) =>
        row.original.genre ? (
          <span
            className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
              row.original.genre.toLowerCase().startsWith("f")
                ? "bg-pink-100 text-pink-700"
                : "bg-blue-100 text-blue-700"
            }`}
          >
            {row.original.genre}
          </span>
        ) : (
          "—"
        ),
    },
    {
      header: "Âge",
      accessorKey: "age",
      enableSorting: true,
      cell: ({ row }) => {
        const p = row.original;
        if (p.age == null) return "—";
        const unit = p.yearOrMonth ? "ans" : "mois";
        return `${p.age} ${unit}`;
      },
    },
    {
      header: "Contacts",
      id: "contacts",
      accessorFn: (row) =>
        [row.telephone1, row.telephone2].filter(Boolean).join(" / "),
      enableSorting: true,
      cell: ({ row }) =>
        [row.original.telephone1, row.original.telephone2]
          .filter(Boolean)
          .join(" / ") || "—",
    },
    {
      header: "Email",
      accessorKey: "email",
      enableSorting: true,
      cell: ({ row }) =>
        row.original.email ? (
          <a
            href={`mailto:${row.original.email}`}
            className="text-blue-600 hover:underline"
          >
            {row.original.email}
          </a>
        ) : (
          "—"
        ),
    },
    {
      header: "Actions",
      id: "actions",
      enableSorting: false,
      cell: ({ row }) => {
        const patient = row.original;
        return (
          <div className="flex items-center gap-1">
            {/* Voir — toujours visible */}
            <Link
              href={`/patients/${patient.id}`}
              className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs font-medium bg-blue-600 text-white hover:bg-blue-700 transition-colors"
              title="Voir le profil"
            >
              <Eye className="h-3.5 w-3.5" />
            </Link>

            {/* Modifier */}
            <PermissionGate permission={PERMISSIONS.EDIT_PATIENTS}>
              <button
                type="button"
                onClick={() => handleOpenEdit(patient)}
                className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs font-medium bg-blue-600 text-white hover:bg-blue-700 transition-colors"
                title="Modifier"
              >
                <Pencil className="h-3.5 w-3.5" />
              </button>
            </PermissionGate>

            {/* Supprimer */}
            <PermissionGate permission={PERMISSIONS.DELETE_PATIENTS}>
              <button
                type="button"
                onClick={() => setDeleteConfirm(patient)}
                className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs font-medium bg-red-600 text-white hover:bg-red-700 transition-colors"
                title="Supprimer"
              >
                <Trash2 className="h-3.5 w-3.5" />
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
        title="Patients"
        action={
          can(PERMISSIONS.CREATE_PATIENTS) ? (
            <button
              type="button"
              onClick={() => setCreateOpen(true)}
              className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700"
            >
              <Plus className="h-4 w-4" />
              Ajouter un nouveau patient
            </button>
          ) : undefined
        }
      />

      <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        {/* Barre de recherche + compteur (cohérent avec Hôpitaux/Médecins) */}
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="relative w-full max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(0);
              }}
              placeholder="Rechercher (code, nom, prénom, téléphone, email)..."
              className="w-full rounded-md border border-gray-300 pl-9 pr-3 py-2 text-sm shadow-sm placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
          <div className="text-sm text-gray-500">
            {data?.totalElements ?? 0} patient{(data?.totalElements ?? 0) > 1 ? "s" : ""} au total
          </div>
        </div>

        <DataTable
          columns={columns}
          data={patients}
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

      {/* ================================================================
          Modal Création
      ================================================================ */}
      <CrudModal
        isOpen={createOpen}
        onClose={handleCloseCreate}
        title="Ajouter un nouveau patient"
        size="lg"
        onSubmit={handleSubmitCreate(onCreateSubmit)}
        submitLabel="Ajouter un nouveau patient"
        isSubmitting={createMutation.isPending}
      >
        <PatientFormFields register={registerCreate} errors={createErrors} />
      </CrudModal>

      {/* ================================================================
          Modal Édition
      ================================================================ */}
      <CrudModal
        isOpen={editOpen}
        onClose={handleCloseEdit}
        title="Modifier le patient"
        size="lg"
        onSubmit={handleSubmitEdit(onEditSubmit)}
        submitLabel="Modifier"
        isSubmitting={updateMutation.isPending}
      >
        <PatientFormFields register={registerEdit} errors={editErrors} />
      </CrudModal>

      {/* ================================================================
          Confirm suppression
      ================================================================ */}
      <ConfirmModal
        isOpen={deleteConfirm !== null}
        onClose={() => setDeleteConfirm(null)}
        onConfirm={() => {
          if (deleteConfirm) deleteMutation.mutate(deleteConfirm.id);
        }}
        title="Supprimer ce patient"
        message={
          deleteConfirm
            ? `Voulez-vous vraiment supprimer ${deleteConfirm.lastname} ${deleteConfirm.firstname} ? Cette action est irréversible.`
            : ""
        }
        confirmLabel="Supprimer"
        confirmVariant="danger"
        isLoading={deleteMutation.isPending}
      />
    </div>
  );
}
