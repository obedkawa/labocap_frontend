"use client";

import { use, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import {
  ArrowLeft,
  Pencil,
  Trash2,
  Plus,
  Phone,
  Mail,
  Download,
} from "lucide-react";
import Link from "next/link";
import type { ColumnDef } from "@tanstack/react-table";
import type { AxiosError } from "axios";

import { DataTable } from "@/components/common/DataTable";
import { CrudModal } from "@/components/common/CrudModal";
import { ConfirmModal } from "@/components/common/ConfirmModal";
import { FormField } from "@/components/ui/FormField";
import { NativeSelect } from "@/components/ui/NativeSelect";
import { usePermissions } from "@/hooks/usePermissions";
import { PERMISSIONS } from "@/lib/constants/permissions";
import {
  hrApi,
  type Employee,
  type EmployeeRequest,
  type EmployeeContrat,
  type EmployeeContratRequest,
  type EmployeeDocument,
  type TimeOff,
  type TimeoffStatus,
} from "@/lib/api/hr";
import type { ApiError } from "@/types/api";

// ---------------------------------------------------------------------------
// Constantes & helpers
// ---------------------------------------------------------------------------

const inputClass =
  "w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500";

const NC = "Non renseigné";

// Types de contrat — options de la modale Laravel employee_contrats/create.
const CONTRACT_TYPES = [
  "CDI",
  "CDD",
  "Saisonnier",
  "Apprentissage",
  "Extra",
  "Intérim",
  "Stagiaire",
];

// Statuts de congé — l'enum backend (PENDING/APPROVED/REJECTED) rendu en français.
const TIMEOFF_STATUS: { value: TimeoffStatus; label: string }[] = [
  { value: "PENDING", label: "En attente" },
  { value: "APPROVED", label: "Approuvé" },
  { value: "REJECTED", label: "Rejeté" },
];

function statusLabel(s: TimeoffStatus): string {
  return TIMEOFF_STATUS.find((x) => x.value === s)?.label ?? s;
}

function formatMoney(v?: number | null): string {
  if (v == null) return NC;
  return new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 }).format(v);
}

function formatDate(s?: string | null): string {
  if (!s) return NC;
  return new Date(s).toLocaleDateString("fr-FR");
}

function initials(employee?: Employee): string {
  if (!employee) return "—";
  const a = (employee.lastName?.[0] ?? "").toUpperCase();
  const b = (employee.firstName?.[0] ?? "").toUpperCase();
  return (a + b) || "—";
}

// ---------------------------------------------------------------------------
// Schémas de formulaire
// ---------------------------------------------------------------------------

const employeeSchema = z.object({
  firstName: z.string().min(1, "Le prénom est requis"),
  lastName: z.string().min(1, "Le nom est requis"),
  email: z.string().email("Email invalide").optional().or(z.literal("")),
  phone: z.string().optional(),
});
type EmployeeForm = z.infer<typeof employeeSchema>;

const contratSchema = z.object({
  type: z.string().optional(),
  startDate: z.string().min(1, "La date de début est requise"),
  endDate: z.string().optional(),
  salary: z.string().min(1, "Le salaire est requis"),
});
type ContratForm = z.infer<typeof contratSchema>;

const docSchema = z.object({
  name: z.string().min(1, "Le nom du fichier est requis"),
});
type DocForm = z.infer<typeof docSchema>;

// ---------------------------------------------------------------------------
// Page — Fiche employé (réplique Laravel employees/detail.blade.php)
// ---------------------------------------------------------------------------

export default function EmployeeDetailPage({
  params: paramsPromise,
}: {
  params: Promise<{ id: string }>;
}) {
  const employeeId = use(paramsPromise).id;
  const { can } = usePermissions();
  const queryClient = useQueryClient();
  const canEdit = can(PERMISSIONS.EDIT_EMPLOYEES);

  // ---- Employé -------------------------------------------------------------
  const { data: employee } = useQuery({
    queryKey: ["employee", employeeId],
    queryFn: () => hrApi.findById(employeeId).then((r) => r.data),
  });

  const [editEmpOpen, setEditEmpOpen] = useState(false);
  const empForm = useForm<EmployeeForm>({ resolver: zodResolver(employeeSchema) });

  const updateEmpMutation = useMutation({
    mutationFn: (d: EmployeeForm) =>
      hrApi.update(employeeId, {
        firstName: d.firstName,
        lastName: d.lastName,
        email: d.email || undefined,
        phone: d.phone || undefined,
        // Préservés : le backend écrase position/salary/hireDate si absents.
        position: employee?.position,
        salary: employee?.salary,
        hireDate: employee?.hireDate,
      } as EmployeeRequest),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["employee", employeeId] });
      queryClient.invalidateQueries({ queryKey: ["employees"] });
      toast.success("Employé modifié");
      setEditEmpOpen(false);
    },
    onError: (e: AxiosError<ApiError>) =>
      toast.error(e.response?.data?.message ?? "Erreur lors de la modification"),
  });

  function openEditEmp() {
    if (!employee) return;
    empForm.reset({
      firstName: employee.firstName,
      lastName: employee.lastName,
      email: employee.email ?? "",
      phone: employee.phone ?? "",
    });
    setEditEmpOpen(true);
  }

  // ---- Contrats ------------------------------------------------------------
  const { data: contratsData, isLoading: contratsLoading } = useQuery({
    queryKey: ["employee-contrats", employeeId],
    queryFn: () =>
      hrApi.getContrats(employeeId, { size: 100 }).then((r) => r.data),
  });
  const contrats = contratsData?.content ?? [];

  const [contratModalOpen, setContratModalOpen] = useState(false);
  const [editingContrat, setEditingContrat] = useState<EmployeeContrat | null>(null);
  const [deleteContrat, setDeleteContrat] = useState<EmployeeContrat | null>(null);
  const contratForm = useForm<ContratForm>({ resolver: zodResolver(contratSchema) });

  const saveContratMutation = useMutation({
    mutationFn: (d: ContratForm) => {
      const payload: EmployeeContratRequest = {
        type: d.type || undefined,
        startDate: d.startDate,
        endDate: d.endDate || undefined,
        salary: Number(d.salary),
      };
      return editingContrat
        ? hrApi.updateContrat(employeeId, editingContrat.id, payload)
        : hrApi.createContrat(employeeId, payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["employee-contrats", employeeId] });
      toast.success(editingContrat ? "Contrat modifié" : "Contrat créé");
      setContratModalOpen(false);
      setEditingContrat(null);
    },
    onError: (e: AxiosError<ApiError>) =>
      toast.error(e.response?.data?.message ?? "Erreur lors de l'enregistrement"),
  });

  const deleteContratMutation = useMutation({
    mutationFn: (id: string) => hrApi.deleteContrat(employeeId, id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["employee-contrats", employeeId] });
      toast.success("Contrat supprimé");
      setDeleteContrat(null);
    },
    onError: (e: AxiosError<ApiError>) =>
      toast.error(e.response?.data?.message ?? "Erreur lors de la suppression"),
  });

  function openNewContrat() {
    setEditingContrat(null);
    contratForm.reset({ type: "", startDate: "", endDate: "", salary: "" });
    setContratModalOpen(true);
  }
  function openEditContrat(c: EmployeeContrat) {
    setEditingContrat(c);
    contratForm.reset({
      type: c.type ?? "",
      startDate: c.startDate ?? "",
      endDate: c.endDate ?? "",
      salary: c.salary != null ? String(c.salary) : "",
    });
    setContratModalOpen(true);
  }

  const contratColumns: ColumnDef<EmployeeContrat>[] = [
    {
      header: "#",
      id: "rownum",
      cell: ({ row }) => <span className="text-gray-500">{row.index + 1}</span>,
    },
    { header: "Type", accessorKey: "type", cell: ({ row }) => row.original.type ?? NC },
    {
      header: "Début",
      accessorKey: "startDate",
      cell: ({ row }) => formatDate(row.original.startDate),
    },
    {
      header: "Fin",
      accessorKey: "endDate",
      cell: ({ row }) => formatDate(row.original.endDate),
    },
    {
      header: "Salaire brute mensuelle",
      accessorKey: "salary",
      cell: ({ row }) => formatMoney(row.original.salary),
    },
    {
      header: "Actions",
      id: "actions",
      cell: ({ row }) =>
        canEdit ? (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => openEditContrat(row.original)}
              className="inline-flex items-center justify-center rounded bg-sky-500 p-1.5 text-white hover:bg-sky-600"
              title="Modifier"
            >
              <Pencil className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => setDeleteContrat(row.original)}
              className="inline-flex items-center justify-center rounded bg-red-600 p-1.5 text-white hover:bg-red-700"
              title="Supprimer"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        ) : null,
    },
  ];

  // ---- Congés --------------------------------------------------------------
  const { data: congesData, isLoading: congesLoading } = useQuery({
    queryKey: ["employee-timeoffs", employeeId],
    queryFn: () =>
      hrApi.getTimeOffs(employeeId, { size: 100 }).then((r) => r.data),
  });
  const conges = congesData?.content ?? [];

  const [deleteConge, setDeleteConge] = useState<TimeOff | null>(null);

  const updateCongeStatusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: TimeoffStatus }) =>
      hrApi.updateTimeoffStatus(employeeId, id, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["employee-timeoffs", employeeId] });
      toast.success("Statut modifié");
    },
    onError: (e: AxiosError<ApiError>) =>
      toast.error(e.response?.data?.message ?? "Erreur lors de la modification"),
  });

  const deleteCongeMutation = useMutation({
    mutationFn: (id: string) => hrApi.deleteTimeOff(employeeId, id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["employee-timeoffs", employeeId] });
      toast.success("Congé supprimé");
      setDeleteConge(null);
    },
    onError: (e: AxiosError<ApiError>) =>
      toast.error(e.response?.data?.message ?? "Erreur lors de la suppression"),
  });

  const congeColumns: ColumnDef<TimeOff>[] = [
    {
      header: "Date début",
      accessorKey: "startDate",
      cell: ({ row }) => formatDate(row.original.startDate),
    },
    {
      header: "Date fin",
      accessorKey: "endDate",
      cell: ({ row }) => formatDate(row.original.endDate),
    },
    { header: "Type", accessorKey: "reason", cell: ({ row }) => row.original.reason ?? NC },
    {
      header: "Status",
      id: "status",
      cell: ({ row }) =>
        canEdit ? (
          <NativeSelect
            value={row.original.status}
            onChange={(e) =>
              updateCongeStatusMutation.mutate({
                id: row.original.id,
                status: e.target.value as TimeoffStatus,
              })
            }
            className="w-44"
          >
            {TIMEOFF_STATUS.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </NativeSelect>
        ) : (
          <span className="inline-flex items-center rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-700">
            {statusLabel(row.original.status)}
          </span>
        ),
    },
    {
      header: "Actions",
      id: "actions",
      cell: ({ row }) =>
        canEdit ? (
          <button
            type="button"
            onClick={() => setDeleteConge(row.original)}
            className="inline-flex items-center justify-center rounded bg-red-600 p-1.5 text-white hover:bg-red-700"
            title="Supprimer"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        ) : null,
    },
  ];

  // ---- Documents -----------------------------------------------------------
  const { data: docsData, isLoading: docsLoading } = useQuery({
    queryKey: ["employee-docs", employeeId],
    queryFn: () =>
      hrApi.getDocuments(employeeId, { size: 100 }).then((r) => r.data),
  });
  const docs = docsData?.content ?? [];

  const [docModalOpen, setDocModalOpen] = useState(false);
  const [editingDoc, setEditingDoc] = useState<EmployeeDocument | null>(null);
  const [deleteDoc, setDeleteDoc] = useState<EmployeeDocument | null>(null);
  const [docFile, setDocFile] = useState<File | undefined>(undefined);
  const docForm = useForm<DocForm>({ resolver: zodResolver(docSchema) });

  const saveDocMutation = useMutation({
    mutationFn: (d: DocForm) =>
      editingDoc
        ? hrApi.updateDocument(editingDoc.id, { name: d.name })
        : hrApi.uploadDocument(employeeId, d.name, undefined, docFile),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["employee-docs", employeeId] });
      toast.success(editingDoc ? "Document modifié" : "Document ajouté");
      setDocModalOpen(false);
      setEditingDoc(null);
      setDocFile(undefined);
    },
    onError: (e: AxiosError<ApiError>) =>
      toast.error(e.response?.data?.message ?? "Erreur lors de l'enregistrement"),
  });

  const deleteDocMutation = useMutation({
    mutationFn: (id: string) => hrApi.deleteDocument(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["employee-docs", employeeId] });
      toast.success("Document supprimé");
      setDeleteDoc(null);
    },
    onError: (e: AxiosError<ApiError>) =>
      toast.error(e.response?.data?.message ?? "Erreur lors de la suppression"),
  });

  function openNewDoc() {
    setEditingDoc(null);
    setDocFile(undefined);
    docForm.reset({ name: "" });
    setDocModalOpen(true);
  }
  function openEditDoc(d: EmployeeDocument) {
    setEditingDoc(d);
    setDocFile(undefined);
    docForm.reset({ name: d.name });
    setDocModalOpen(true);
  }

  const docColumns: ColumnDef<EmployeeDocument>[] = [
    {
      header: "#",
      id: "rownum",
      cell: ({ row }) => <span className="text-gray-500">{row.index + 1}</span>,
    },
    { header: "Nom", accessorKey: "name" },
    {
      header: "Fichier",
      id: "file",
      cell: ({ row }) => (
        <button
          type="button"
          onClick={() => hrApi.downloadDocument(row.original.id, row.original.name)}
          className="inline-flex items-center gap-1 text-sm font-medium text-blue-600 hover:underline"
        >
          <Download className="h-4 w-4" />
          Télécharger
        </button>
      ),
    },
    {
      header: "Actions",
      id: "actions",
      cell: ({ row }) =>
        canEdit ? (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => openEditDoc(row.original)}
              className="inline-flex items-center justify-center rounded bg-sky-500 p-1.5 text-white hover:bg-sky-600"
              title="Modifier"
            >
              <Pencil className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => setDeleteDoc(row.original)}
              className="inline-flex items-center justify-center rounded bg-red-600 p-1.5 text-white hover:bg-red-700"
              title="Supprimer"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        ) : null,
    },
  ];

  // ---- Render --------------------------------------------------------------
  return (
    <div className="space-y-5">
      {/* En-tête : titre + Retour */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-gray-900">Employé</h1>
        <Link
          href="/hr/employees"
          className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Retour
        </Link>
      </div>

      {/* Carte profil (bleue) */}
      <div className="overflow-hidden rounded-xl bg-gradient-to-r from-blue-600 to-blue-500 p-6 shadow-sm">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-5">
            {employee?.photoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={employee.photoUrl}
                alt=""
                className="h-24 w-24 rounded-full border-4 border-white/30 object-cover"
              />
            ) : (
              <div className="flex h-24 w-24 flex-shrink-0 items-center justify-center rounded-full bg-white/20 text-3xl font-bold text-white">
                {initials(employee)}
              </div>
            )}
            <div>
              <h2 className="text-2xl font-bold text-white">
                {employee ? `${employee.lastName} ${employee.firstName}` : "…"}
              </h2>
              <p className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-blue-50">
                <span className="inline-flex items-center gap-1">
                  <Phone className="h-4 w-4" />
                  {employee?.phone || NC}
                </span>
                <span className="inline-flex items-center gap-1">
                  <Mail className="h-4 w-4" />
                  {employee?.email || NC}
                </span>
              </p>

              <ul className="mt-4 flex flex-wrap gap-x-10 gap-y-3">
                <li>
                  <div className="text-sm font-semibold text-white">
                    {employee?.address || NC}
                  </div>
                  <div className="text-xs text-blue-100">Adresse</div>
                </li>
                <li>
                  <div className="text-sm font-semibold text-white">
                    {employee?.dateOfBirth || NC} ,&nbsp;{employee?.placeOfBirth || NC}
                  </div>
                  <div className="text-xs text-blue-100">
                    Date et lieu de naissance
                  </div>
                </li>
                <li>
                  <div className="text-sm font-semibold text-white">
                    {employee?.cnssNumber || NC}
                  </div>
                  <div className="text-xs text-blue-100">
                    N° de sécurité sociale
                  </div>
                </li>
              </ul>
            </div>
          </div>

          {canEdit && (
            <div className="flex-shrink-0">
              <button
                type="button"
                onClick={openEditEmp}
                className="rounded-lg bg-white px-4 py-2 text-sm font-medium text-blue-700 shadow-sm hover:bg-blue-50"
              >
                Modifier
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Contrats */}
      <Section
        title="Contrats"
        action={
          canEdit && (
            <button
              type="button"
              onClick={openNewContrat}
              className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
            >
              <Plus className="h-4 w-4" />
              Nouveau contrat
            </button>
          )
        }
      >
        <DataTable columns={contratColumns} data={contrats} isLoading={contratsLoading} />
      </Section>

      {/* Congés */}
      <Section
        title="Congés"
        action={
          canEdit && (
            <Link
              href={`/hr/timeoff/nouvelle?employeeId=${employeeId}`}
              className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
            >
              <Plus className="h-4 w-4" />
              Demande de congé
            </Link>
          )
        }
      >
        <DataTable columns={congeColumns} data={conges} isLoading={congesLoading} />
      </Section>

      {/* Documents */}
      <Section
        title="Documents"
        action={
          canEdit && (
            <button
              type="button"
              onClick={openNewDoc}
              className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
            >
              <Plus className="h-4 w-4" />
              Nouveau document
            </button>
          )
        }
      >
        <DataTable columns={docColumns} data={docs} isLoading={docsLoading} />
      </Section>

      {/* ============================ MODALES ============================ */}

      {/* Modifier l'employé */}
      <CrudModal
        isOpen={editEmpOpen}
        onClose={() => setEditEmpOpen(false)}
        title="Modifier l'employé"
        onSubmit={empForm.handleSubmit((d) => updateEmpMutation.mutate(d))}
        submitLabel="Modifier"
        isSubmitting={updateEmpMutation.isPending}
      >
        <div className="grid grid-cols-1 gap-4">
          <FormField label="Nom" required error={empForm.formState.errors.lastName?.message}>
            <input type="text" {...empForm.register("lastName")} className={inputClass} />
          </FormField>
          <FormField label="Prénom" required error={empForm.formState.errors.firstName?.message}>
            <input type="text" {...empForm.register("firstName")} className={inputClass} />
          </FormField>
          <FormField label="Email" error={empForm.formState.errors.email?.message}>
            <input type="email" {...empForm.register("email")} className={inputClass} />
          </FormField>
          <FormField label="Téléphone" error={empForm.formState.errors.phone?.message}>
            <input type="tel" {...empForm.register("phone")} className={inputClass} />
          </FormField>
        </div>
      </CrudModal>

      {/* Contrat (création / édition) */}
      <CrudModal
        isOpen={contratModalOpen}
        onClose={() => { setContratModalOpen(false); setEditingContrat(null); }}
        title={editingContrat ? "Modifier le contrat" : "Nouveau contrat"}
        onSubmit={contratForm.handleSubmit((d) => saveContratMutation.mutate(d))}
        submitLabel={editingContrat ? "Modifier" : "Ajouter"}
        isSubmitting={saveContratMutation.isPending}
      >
        <div className="grid grid-cols-1 gap-4">
          <FormField label="Type de contrat">
            <NativeSelect {...contratForm.register("type")}>
              <option value="">Sélectionner un type de contrat</option>
              {CONTRACT_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </NativeSelect>
          </FormField>
          <FormField
            label="Date de début"
            required
            error={contratForm.formState.errors.startDate?.message}
          >
            <input type="date" {...contratForm.register("startDate")} className={inputClass} />
          </FormField>
          <FormField label="Date de fin" error={contratForm.formState.errors.endDate?.message}>
            <input type="date" {...contratForm.register("endDate")} className={inputClass} />
          </FormField>
          <FormField
            label="Salaire brute/Mois (FCFA)"
            required
            error={contratForm.formState.errors.salary?.message}
          >
            <input
              type="number"
              min={0}
              step="1"
              {...contratForm.register("salary")}
              className={inputClass}
            />
          </FormField>
        </div>
      </CrudModal>

      {/* Document (création / édition) */}
      <CrudModal
        isOpen={docModalOpen}
        onClose={() => { setDocModalOpen(false); setEditingDoc(null); }}
        title={editingDoc ? "Modifier le document" : "Nouveau document"}
        onSubmit={docForm.handleSubmit((d) => saveDocMutation.mutate(d))}
        submitLabel={editingDoc ? "Modifier" : "Ajouter"}
        isSubmitting={saveDocMutation.isPending}
      >
        <div className="grid grid-cols-1 gap-4">
          <FormField label="Nom du fichier" required error={docForm.formState.errors.name?.message}>
            <input type="text" {...docForm.register("name")} className={inputClass} />
          </FormField>
          {!editingDoc && (
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-gray-700">Fichier</label>
              <input
                type="file"
                onChange={(e) => setDocFile(e.target.files?.[0])}
                className="block w-full text-sm text-gray-500 file:mr-4 file:rounded file:border-0 file:bg-blue-50 file:px-4 file:py-2 file:text-sm file:font-medium file:text-blue-700 hover:file:bg-blue-100"
              />
              {docFile && (
                <p className="text-xs text-gray-500">{docFile.name}</p>
              )}
            </div>
          )}
        </div>
      </CrudModal>

      {/* Confirmations de suppression */}
      <ConfirmModal
        isOpen={deleteContrat !== null}
        onClose={() => setDeleteContrat(null)}
        onConfirm={() => deleteContrat && deleteContratMutation.mutate(deleteContrat.id)}
        title="Supprimer ce contrat"
        message="Voulez-vous vraiment supprimer ce contrat ?"
        confirmLabel="Supprimer"
        confirmVariant="danger"
        isLoading={deleteContratMutation.isPending}
      />
      <ConfirmModal
        isOpen={deleteConge !== null}
        onClose={() => setDeleteConge(null)}
        onConfirm={() => deleteConge && deleteCongeMutation.mutate(deleteConge.id)}
        title="Supprimer ce congé"
        message="Voulez-vous vraiment supprimer ce congé ?"
        confirmLabel="Supprimer"
        confirmVariant="danger"
        isLoading={deleteCongeMutation.isPending}
      />
      <ConfirmModal
        isOpen={deleteDoc !== null}
        onClose={() => setDeleteDoc(null)}
        onConfirm={() => deleteDoc && deleteDocMutation.mutate(deleteDoc.id)}
        title="Supprimer ce document"
        message={deleteDoc ? `Supprimer le document « ${deleteDoc.name} » ?` : ""}
        confirmLabel="Supprimer"
        confirmVariant="danger"
        isLoading={deleteDocMutation.isPending}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Section — carte titrée avec bouton d'action (calque des cards Laravel)
// ---------------------------------------------------------------------------

function Section({
  title,
  action,
  children,
}: {
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
        {action}
      </div>
      {children}
    </div>
  );
}
