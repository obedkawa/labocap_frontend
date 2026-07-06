"use client";

import { use, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { ArrowLeft, Pencil, Trash2, Plus, FileText, Briefcase, Upload } from "lucide-react";
import Link from "next/link";
import type { ColumnDef } from "@tanstack/react-table";
import type { AxiosError } from "axios";

import { PageHeader } from "@/components/ui/PageHeader";
import { RHFSelect } from "@/components/ui/RHFSelect";
import { DataTable } from "@/components/common/DataTable";
import { CrudModal } from "@/components/common/CrudModal";
import { ConfirmModal } from "@/components/common/ConfirmModal";
import { PermissionGate } from "@/components/common/PermissionGate";
import { FormField } from "@/components/ui/FormField";
import { usePermissions } from "@/hooks/usePermissions";
import { PERMISSIONS } from "@/lib/constants/permissions";
import {
  hrApi,
  type EmployeeContrat,
  type EmployeeContratRequest,
  type EmployeeDocument,
} from "@/lib/api/hr";
import type { ApiError } from "@/types/api";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const inputClass =
  "w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500";

function formatSalary(v?: number) {
  if (v == null) return "—";
  return new Intl.NumberFormat("fr-FR").format(v) + " FCFA";
}

function formatDate(s?: string) {
  if (!s) return "—";
  return new Date(s).toLocaleDateString("fr-FR");
}

function formatSize(bytes?: number) {
  if (!bytes) return "—";
  if (bytes < 1024) return bytes + " o";
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " Ko";
  return (bytes / (1024 * 1024)).toFixed(1) + " Mo";
}

// ---------------------------------------------------------------------------
// Contract types
// ---------------------------------------------------------------------------

const CONTRACT_TYPES = [
  { value: "CDI", label: "CDI" },
  { value: "CDD", label: "CDD" },
  { value: "STAGE", label: "Stage" },
  { value: "FREELANCE", label: "Freelance" },
  { value: "AUTRE", label: "Autre" },
];

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

const contratSchema = z.object({
  type: z.string().optional(),
  startDate: z.string().min(1, "La date de début est requise"),
  endDate: z.string().optional(),
  salary: z.string().min(1, "Le salaire est requis"),
});
type ContratForm = z.infer<typeof contratSchema>;

const docSchema = z.object({
  name: z.string().min(1, "Le nom est requis"),
  type: z.string().optional(),
});
type DocForm = z.infer<typeof docSchema>;

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

type Tab = "contrats" | "documents";

export default function EmployeeProfilePage({
  params: paramsPromise,
}: {
  params: Promise<{ id: string }>;
}) {
  const params = use(paramsPromise);
  const employeeId = params.id;

  const { can } = usePermissions();
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState<Tab>("contrats");

  // ---- Employee info -------------------------------------------------------

  const { data: employee, isLoading: empLoading } = useQuery({
    queryKey: ["employee", employeeId],
    queryFn: () => hrApi.findById(employeeId).then((r) => r.data),
  });

  // ===========================================================================
  // CONTRATS
  // ===========================================================================

  const [contratPage, setContratPage] = useState(0);
  const [contratSize, setContratSize] = useState(10);
  const [createContratOpen, setCreateContratOpen] = useState(false);
  const [editContratOpen, setEditContratOpen] = useState(false);
  const [selectedContrat, setSelectedContrat] = useState<EmployeeContrat | null>(null);
  const [deleteContrat, setDeleteContrat] = useState<EmployeeContrat | null>(null);

  const contratCreateForm = useForm<ContratForm>({ resolver: zodResolver(contratSchema) });
  const contratEditForm = useForm<ContratForm>({ resolver: zodResolver(contratSchema) });

  const { data: contratsData, isLoading: contratsLoading } = useQuery({
    queryKey: ["employee-contrats", employeeId, contratPage, contratSize],
    queryFn: () => hrApi.getContrats(employeeId, { page: contratPage, size: contratSize }).then((r) => r.data),
    enabled: activeTab === "contrats",
  });

  const contrats = contratsData?.content ?? [];
  const contratsPageCount = contratsData?.totalPages ?? 0;

  const createContratMutation = useMutation({
    mutationFn: (d: ContratForm) =>
      hrApi.createContrat(employeeId, {
        type: d.type || undefined,
        startDate: d.startDate,
        endDate: d.endDate || undefined,
        salary: Number(d.salary),
      } as EmployeeContratRequest),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["employee-contrats", employeeId] });
      toast.success("Contrat créé");
      setCreateContratOpen(false);
      contratCreateForm.reset();
    },
    onError: (e: AxiosError<ApiError>) =>
      toast.error(e.response?.data?.message ?? "Erreur lors de la création"),
  });

  const updateContratMutation = useMutation({
    mutationFn: ({ id, d }: { id: string; d: ContratForm }) =>
      hrApi.updateContrat(employeeId, id, {
        type: d.type || undefined,
        startDate: d.startDate,
        endDate: d.endDate || undefined,
        salary: Number(d.salary),
      } as EmployeeContratRequest),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["employee-contrats", employeeId] });
      toast.success("Contrat modifié");
      setEditContratOpen(false);
      setSelectedContrat(null);
    },
    onError: (e: AxiosError<ApiError>) =>
      toast.error(e.response?.data?.message ?? "Erreur lors de la modification"),
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

  function openEditContrat(c: EmployeeContrat) {
    setSelectedContrat(c);
    contratEditForm.reset({
      type: c.type ?? "",
      startDate: c.startDate,
      endDate: c.endDate ?? "",
      salary: c.salary != null ? String(c.salary) : "",
    });
    setEditContratOpen(true);
  }

  const contratColumns: ColumnDef<EmployeeContrat>[] = [
    { header: "Type", accessorKey: "type", cell: ({ row }) => row.original.type ?? "—" },
    { header: "Date début", accessorKey: "startDate", cell: ({ row }) => formatDate(row.original.startDate) },
    { header: "Date fin", accessorKey: "endDate", cell: ({ row }) => formatDate(row.original.endDate) },
    { header: "Salaire", accessorKey: "salary", cell: ({ row }) => formatSalary(row.original.salary) },
    {
      header: "Actions",
      id: "actions",
      cell: ({ row }) => (
        <div className="flex items-center gap-2">
          <PermissionGate permission={PERMISSIONS.EDIT_EMPLOYEES}>
            <button
              type="button"
              onClick={() => openEditContrat(row.original)}
              className="inline-flex items-center justify-center rounded p-1.5 text-gray-500 hover:bg-gray-100 hover:text-blue-600 transition-colors"
              title="Modifier"
            >
              <Pencil className="h-4 w-4" />
            </button>
          </PermissionGate>
          <PermissionGate permission={PERMISSIONS.EDIT_EMPLOYEES}>
            <button
              type="button"
              onClick={() => setDeleteContrat(row.original)}
              className="inline-flex items-center justify-center rounded p-1.5 text-gray-500 hover:bg-gray-100 hover:text-red-600 transition-colors"
              title="Supprimer"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </PermissionGate>
        </div>
      ),
    },
  ];

  // ===========================================================================
  // DOCUMENTS
  // ===========================================================================

  const [docPage, setDocPage] = useState(0);
  const [docSize, setDocSize] = useState(10);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [editDocOpen, setEditDocOpen] = useState(false);
  const [selectedDoc, setSelectedDoc] = useState<EmployeeDocument | null>(null);
  const [deleteDoc, setDeleteDoc] = useState<EmployeeDocument | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | undefined>(undefined);

  const docCreateForm = useForm<DocForm>({ resolver: zodResolver(docSchema) });
  const docEditForm = useForm<DocForm>({ resolver: zodResolver(docSchema) });

  const { data: docsData, isLoading: docsLoading } = useQuery({
    queryKey: ["employee-docs", employeeId, docPage, docSize],
    queryFn: () => hrApi.getDocuments(employeeId, { page: docPage, size: docSize }).then((r) => r.data),
    enabled: activeTab === "documents",
  });

  const docs = docsData?.content ?? [];
  const docsPageCount = docsData?.totalPages ?? 0;

  const uploadDocMutation = useMutation({
    mutationFn: (d: DocForm) =>
      hrApi.uploadDocument(employeeId, d.name, d.type || undefined, selectedFile),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["employee-docs", employeeId] });
      toast.success("Document uploadé");
      setUploadOpen(false);
      docCreateForm.reset();
      setSelectedFile(undefined);
    },
    onError: (e: AxiosError<ApiError>) =>
      toast.error(e.response?.data?.message ?? "Erreur lors de l'upload"),
  });

  const updateDocMutation = useMutation({
    mutationFn: ({ id, d }: { id: string; d: DocForm }) =>
      hrApi.updateDocument(id, { name: d.name, type: d.type || undefined }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["employee-docs", employeeId] });
      toast.success("Document modifié");
      setEditDocOpen(false);
      setSelectedDoc(null);
    },
    onError: (e: AxiosError<ApiError>) =>
      toast.error(e.response?.data?.message ?? "Erreur lors de la modification"),
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

  function openEditDoc(d: EmployeeDocument) {
    setSelectedDoc(d);
    docEditForm.reset({ name: d.name, type: d.type ?? "" });
    setEditDocOpen(true);
  }

  const docColumns: ColumnDef<EmployeeDocument>[] = [
    { header: "Nom", accessorKey: "name" },
    { header: "Type", accessorKey: "type", cell: ({ row }) => row.original.type ?? "—" },
    { header: "Taille", accessorKey: "fileSize", cell: ({ row }) => formatSize(row.original.fileSize) },
    { header: "Date", accessorKey: "createdAt", cell: ({ row }) => formatDate(row.original.createdAt) },
    {
      header: "Actions",
      id: "actions",
      cell: ({ row }) => (
        <div className="flex items-center gap-2">
          <PermissionGate permission={PERMISSIONS.EDIT_EMPLOYEES}>
            <button
              type="button"
              onClick={() => openEditDoc(row.original)}
              className="inline-flex items-center justify-center rounded p-1.5 text-gray-500 hover:bg-gray-100 hover:text-blue-600 transition-colors"
              title="Modifier"
            >
              <Pencil className="h-4 w-4" />
            </button>
          </PermissionGate>
          <PermissionGate permission={PERMISSIONS.EDIT_EMPLOYEES}>
            <button
              type="button"
              onClick={() => setDeleteDoc(row.original)}
              className="inline-flex items-center justify-center rounded p-1.5 text-gray-500 hover:bg-gray-100 hover:text-red-600 transition-colors"
              title="Supprimer"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </PermissionGate>
        </div>
      ),
    },
  ];

  // ===========================================================================
  // Render
  // ===========================================================================

  const fullName = employee
    ? `${employee.lastName} ${employee.firstName}`
    : "Chargement…";

  return (
    <div className="space-y-6">
      <PageHeader
        title={fullName}
        action={
          <Link
            href="/hr/employees"
            className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Retour
          </Link>
        }
      />

      {/* Employee summary card */}
      {!empLoading && employee && (
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <div>
              <dt className="text-xs font-medium text-gray-500 uppercase tracking-wide">Poste</dt>
              <dd className="mt-1 text-sm text-gray-900">{employee.position ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-gray-500 uppercase tracking-wide">Salaire</dt>
              <dd className="mt-1 text-sm text-gray-900">{formatSalary(employee.salary)}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-gray-500 uppercase tracking-wide">Date d'embauche</dt>
              <dd className="mt-1 text-sm text-gray-900">{formatDate(employee.hireDate)}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-gray-500 uppercase tracking-wide">Téléphone</dt>
              <dd className="mt-1 text-sm text-gray-900">{employee.phone ?? "—"}</dd>
            </div>
          </dl>
        </div>
      )}

      {/* Tabs */}
      <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="flex border-b border-gray-200">
          <button
            type="button"
            onClick={() => setActiveTab("contrats")}
            className={`flex items-center gap-2 px-5 py-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === "contrats"
                ? "border-blue-600 text-blue-600"
                : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            <Briefcase className="h-4 w-4" />
            Contrats
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("documents")}
            className={`flex items-center gap-2 px-5 py-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === "documents"
                ? "border-blue-600 text-blue-600"
                : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            <FileText className="h-4 w-4" />
            Documents
          </button>
        </div>

        <div className="p-5">
          {/* ---- CONTRATS TAB ---- */}
          {activeTab === "contrats" && (
            <div className="space-y-4">
              {can(PERMISSIONS.EDIT_EMPLOYEES) && (
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={() => { contratCreateForm.reset(); setCreateContratOpen(true); }}
                    className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
                  >
                    <Plus className="h-4 w-4" />
                    Ajouter un contrat
                  </button>
                </div>
              )}
              <DataTable
                columns={contratColumns}
                data={contrats}
                isLoading={contratsLoading}
                pageCount={contratsPageCount}
                pageIndex={contratPage}
                pageSize={contratSize}
                onPageChange={setContratPage}
                onPageSizeChange={(size) => { setContratSize(size); setContratPage(0); }}
              />
            </div>
          )}

          {/* ---- DOCUMENTS TAB ---- */}
          {activeTab === "documents" && (
            <div className="space-y-4">
              {can(PERMISSIONS.EDIT_EMPLOYEES) && (
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={() => { docCreateForm.reset(); setSelectedFile(undefined); setUploadOpen(true); }}
                    className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
                  >
                    <Upload className="h-4 w-4" />
                    Ajouter un document
                  </button>
                </div>
              )}
              <DataTable
                columns={docColumns}
                data={docs}
                isLoading={docsLoading}
                pageCount={docsPageCount}
                pageIndex={docPage}
                pageSize={docSize}
                onPageChange={setDocPage}
                onPageSizeChange={(size) => { setDocSize(size); setDocPage(0); }}
              />
            </div>
          )}
        </div>
      </div>

      {/* ====================== MODALS CONTRATS ====================== */}

      <CrudModal
        isOpen={createContratOpen}
        onClose={() => setCreateContratOpen(false)}
        title="Ajouter un contrat"
        onSubmit={contratCreateForm.handleSubmit((d) => createContratMutation.mutate(d))}
        submitLabel="Ajouter"
        isSubmitting={createContratMutation.isPending}
      >
        <ContratFormFields form={contratCreateForm} />
      </CrudModal>

      <CrudModal
        isOpen={editContratOpen}
        onClose={() => { setEditContratOpen(false); setSelectedContrat(null); }}
        title="Modifier le contrat"
        onSubmit={contratEditForm.handleSubmit((d) => {
          if (selectedContrat) updateContratMutation.mutate({ id: selectedContrat.id, d });
        })}
        submitLabel="Modifier"
        isSubmitting={updateContratMutation.isPending}
      >
        <ContratFormFields form={contratEditForm} />
      </CrudModal>

      <ConfirmModal
        isOpen={deleteContrat !== null}
        onClose={() => setDeleteContrat(null)}
        onConfirm={() => { if (deleteContrat) deleteContratMutation.mutate(deleteContrat.id); }}
        title="Supprimer ce contrat"
        message={deleteContrat ? `Supprimer le contrat ${deleteContrat.type ?? ""} du ${formatDate(deleteContrat.startDate)} ?` : ""}
        confirmLabel="Supprimer"
        confirmVariant="danger"
        isLoading={deleteContratMutation.isPending}
      />

      {/* ====================== MODALS DOCUMENTS ====================== */}

      <CrudModal
        isOpen={uploadOpen}
        onClose={() => setUploadOpen(false)}
        title="Ajouter un document"
        onSubmit={docCreateForm.handleSubmit((d) => uploadDocMutation.mutate(d))}
        submitLabel="Uploader"
        isSubmitting={uploadDocMutation.isPending}
      >
        <DocFormFields form={docCreateForm} file={selectedFile} onFileChange={setSelectedFile} />
      </CrudModal>

      <CrudModal
        isOpen={editDocOpen}
        onClose={() => { setEditDocOpen(false); setSelectedDoc(null); }}
        title="Modifier le document"
        onSubmit={docEditForm.handleSubmit((d) => {
          if (selectedDoc) updateDocMutation.mutate({ id: selectedDoc.id, d });
        })}
        submitLabel="Modifier"
        isSubmitting={updateDocMutation.isPending}
      >
        <DocFormFields form={docEditForm} />
      </CrudModal>

      <ConfirmModal
        isOpen={deleteDoc !== null}
        onClose={() => setDeleteDoc(null)}
        onConfirm={() => { if (deleteDoc) deleteDocMutation.mutate(deleteDoc.id); }}
        title="Supprimer ce document"
        message={deleteDoc ? `Supprimer le document "${deleteDoc.name}" ?` : ""}
        confirmLabel="Supprimer"
        confirmVariant="danger"
        isLoading={deleteDocMutation.isPending}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// ContratFormFields
// ---------------------------------------------------------------------------

function ContratFormFields({ form }: { form: ReturnType<typeof useForm<ContratForm>> }) {
  const { register, control, formState: { errors } } = form;
  return (
    <div className="flex flex-col gap-4">
      <RHFSelect
        control={control}
        name="type"
        label="Type de contrat"
        options={CONTRACT_TYPES}
        placeholder="Sélectionner…"
        error={errors.type?.message}
        isClearable
      />
      <FormField label="Salaire (FCFA)" required error={errors.salary?.message}>
        <input type="number" {...register("salary")} min={0} placeholder="Ex : 200000" className={inputClass} />
      </FormField>
      <FormField label="Date de début" required error={errors.startDate?.message}>
        <input type="date" {...register("startDate")} className={inputClass} />
      </FormField>
      <FormField label="Date de fin" error={errors.endDate?.message}>
        <input type="date" {...register("endDate")} className={inputClass} />
      </FormField>
    </div>
  );
}

// ---------------------------------------------------------------------------
// DocFormFields
// ---------------------------------------------------------------------------

function DocFormFields({
  form,
  file,
  onFileChange,
}: {
  form: ReturnType<typeof useForm<DocForm>>;
  file?: File;
  onFileChange?: (f: File | undefined) => void;
}) {
  const { register, formState: { errors } } = form;
  return (
    <div className="flex flex-col gap-4">
      <FormField label="Nom du document" required error={errors.name?.message}>
        <input type="text" {...register("name")} placeholder="Ex : Contrat CDI 2024" className={inputClass} />
      </FormField>
      <FormField label="Type" error={errors.type?.message}>
        <input type="text" {...register("type")} placeholder="Ex : Contrat, Diplôme, Pièce d'identité" className={inputClass} />
      </FormField>
      {onFileChange && (
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-gray-700">Fichier</label>
          <input
            type="file"
            onChange={(e) => onFileChange(e.target.files?.[0])}
            className="block w-full text-sm text-gray-500 file:mr-4 file:rounded file:border-0 file:bg-blue-50 file:px-4 file:py-2 file:text-sm file:font-medium file:text-blue-700 hover:file:bg-blue-100"
          />
          {file && <p className="text-xs text-gray-500">{file.name} ({(file.size / 1024).toFixed(1)} Ko)</p>}
        </div>
      )}
    </div>
  );
}
