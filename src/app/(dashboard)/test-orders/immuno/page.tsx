"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Eye, Pencil, FileText, Trash2, Plus, Printer } from "lucide-react";
import type { AxiosError } from "axios";
import type { ColumnDef } from "@tanstack/react-table";

import { toast } from "sonner";
import { DataTable } from "@/components/common/DataTable";
import { ConfirmModal } from "@/components/common/ConfirmModal";
import { PageHeader } from "@/components/ui/PageHeader";
import { usePermissions } from "@/hooks/usePermissions";
import { PERMISSIONS } from "@/lib/constants/permissions";
import { formatCFA, formatDate } from "@/lib/utils";
import { testOrdersApi, type TestOrder } from "@/lib/api/testOrders";
import { usersApi } from "@/lib/api/users";
import apiClient from "@/lib/api/client";
import type { PageResponse, ApiError } from "@/types/api";

// ---------------------------------------------------------------------------
// Types locaux
// ---------------------------------------------------------------------------

interface ContractOption {
  id: string;
  name: string;
}

// Le dropdown "Affecter à" (et le filtre Docteur) référencent un utilisateur
// ayant le rôle docteur — même source que `attribuateDoctorId`.
interface DoctorOption {
  id: string;
  name: string;
}

// ---------------------------------------------------------------------------
// Composant : dropdown "Affecter à" inline dans le tableau
// ---------------------------------------------------------------------------

function AttribuateSelect({
  order,
  doctors,
}: {
  order: TestOrder;
  doctors: DoctorOption[];
}) {
  const queryClient = useQueryClient();
  const [value, setValue] = useState<string>(order.attribuateDoctorId ?? "");

  const mutation = useMutation({
    mutationFn: (doctorId: string) =>
      testOrdersApi.assignDoctor(order.id, doctorId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["test-orders-immuno"] });
      toast.success("Médecin affecté");
    },
    onError: () => toast.error("Erreur lors de l'affectation"),
  });

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const doctorId = e.target.value;
    setValue(doctorId);
    if (doctorId) mutation.mutate(doctorId);
  };

  return (
    <select
      value={value}
      onChange={handleChange}
      disabled={mutation.isPending}
      className="rounded border border-gray-300 px-2 py-1 text-xs focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 min-w-[140px]"
    >
      <option value="">Sélectionner un docteur</option>
      {doctors.map((d) => (
        <option key={d.id} value={d.id}>
          {d.name}
        </option>
      ))}
    </select>
  );
}

// ---------------------------------------------------------------------------
// Composant : boutons d'action par ligne
// ---------------------------------------------------------------------------

function ActionButtons({
  order,
  onDelete,
}: {
  order: TestOrder;
  onDelete: (order: TestOrder) => void;
}) {
  const { can } = usePermissions();
  const router = useRouter();
  const [creatingInvoice, setCreatingInvoice] = useState(false);

  const handleCreateInvoice = async () => {
    setCreatingInvoice(true);
    try {
      const res = await apiClient.post<{ id: string }>(
        `/invoices/from-order/${order.id}`
      );
      router.push(`/invoices/${res.data.id}`);
    } catch {
      toast.error("Erreur lors de la création de la facture");
    } finally {
      setCreatingInvoice(false);
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-1">
      {/* Voir les détails — BLEU */}
      <Link
        href={`/test-orders/${order.id}/details`}
        className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs font-medium bg-blue-600 text-white hover:bg-blue-700 transition-colors"
        title="Voir les détails"
      >
        <Eye className="h-3.5 w-3.5" />
      </Link>

      {/* Modifier — BLEU */}
      {can(PERMISSIONS.EDIT_TEST_ORDERS) && (
        <Link
          href={`/test-orders/${order.id}/edit`}
          className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs font-medium bg-blue-600 text-white hover:bg-blue-700 transition-colors"
          title="Mettre à jour l'examen"
        >
          <Pencil className="h-3.5 w-3.5" />
        </Link>
      )}

      {/* Compte rendu — JAUNE */}
      {order.reportId && can(PERMISSIONS.VIEW_REPORTS) && (
        <Link
          href={`/reports/${order.reportId}`}
          className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs font-medium bg-yellow-500 text-white hover:bg-yellow-600 transition-colors"
          title="Compte rendu"
        >
          <FileText className="h-3.5 w-3.5" />
        </Link>
      )}

      {/* Facture — VERT */}
      {order.invoiceId ? (
        <Link
          href={`/invoices/${order.invoiceId}`}
          className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs font-medium bg-green-600 text-white hover:bg-green-700 transition-colors"
          title="Voir la facture"
        >
          <Printer className="h-3.5 w-3.5" />
        </Link>
      ) : order.reportStatus === "VALIDATED" ||
        order.reportStatus === "DELIVERED" ? (
        <button
          type="button"
          onClick={handleCreateInvoice}
          disabled={creatingInvoice}
          className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs font-medium bg-green-600 text-white hover:bg-green-700 transition-colors disabled:opacity-50"
          title="Créer la facture"
        >
          <Printer className="h-3.5 w-3.5" />
        </button>
      ) : null}

      {/* Supprimer — ROUGE */}
      {order.status !== "VALIDATED" &&
        order.status !== "DELIVERED" &&
        can(PERMISSIONS.DELETE_TEST_ORDERS) && (
          <button
            type="button"
            onClick={() => onDelete(order)}
            className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs font-medium bg-red-600 text-white hover:bg-red-700 transition-colors"
            title="Supprimer"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page principale
// ---------------------------------------------------------------------------

export default function TestOrdersImmunoPage() {
  const { can } = usePermissions();
  const queryClient = useQueryClient();

  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(10);

  // Filtres (sans typeOrderId — implicite immuno)
  const [contratFilter, setContratFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [urgentFilter, setUrgentFilter] = useState("");
  const [docteurFilter, setDocteurFilter] = useState("");
  const [search, setSearch] = useState("");
  const [dateBegin, setDateBegin] = useState("");
  const [dateEnd, setDateEnd] = useState("");

  const [deleteTarget, setDeleteTarget] = useState<TestOrder | null>(null);

  // --- Queries données
  const { data, isLoading } = useQuery<PageResponse<TestOrder>>({
    queryKey: [
      "test-orders-immuno",
      { page, pageSize, contratFilter, statusFilter, urgentFilter, docteurFilter, search, dateBegin, dateEnd },
    ],
    queryFn: () =>
      testOrdersApi
        .findAllImmuno({
          page,
          size: pageSize,
          contratId: contratFilter || undefined,
          status: statusFilter || undefined,
          isUrgent: urgentFilter === "1" ? true : undefined,
          attribuateDoctorId: docteurFilter || undefined,
          search: search || undefined,
          from: dateBegin || undefined,
          to: dateEnd || undefined,
        })
        .then((r) => r.data),
  });

  const { data: contractsData } = useQuery<ContractOption[]>({
    queryKey: ["contracts-filter"],
    queryFn: async () => {
      const res = await apiClient.get<PageResponse<ContractOption>>(
        "/contracts",
        { params: { size: 1000 } }
      );
      return res.data.content;
    },
  });

  // Utilisateurs ayant le rôle docteur — source cohérente avec attribuateDoctorId
  const { data: doctorsData } = useQuery<DoctorOption[]>({
    queryKey: ["users-doctors"],
    queryFn: () =>
      usersApi
        .findAll({ size: 500, role: "doctor" })
        .then((r) =>
          r.data.content.map((u) => ({
            id: u.id,
            name: `${u.firstname} ${u.lastname}`.trim(),
          }))
        ),
  });

  // Stats globales (Livrer / Valider / Cas urgent) — variantes immuno
  const { data: statsLivrer } = useQuery({
    queryKey: ["test-orders-immuno-stats-livrer"],
    queryFn: () =>
      testOrdersApi
        .findAllImmuno({ page: 0, size: 1, status: "DELIVERED" })
        .then((r) => r.data.totalElements),
  });
  const { data: statsValider } = useQuery({
    queryKey: ["test-orders-immuno-stats-valider"],
    queryFn: () =>
      testOrdersApi
        .findAllImmuno({ page: 0, size: 1, status: "VALIDATED" })
        .then((r) => r.data.totalElements),
  });
  const { data: statsUrgent } = useQuery({
    queryKey: ["test-orders-immuno-stats-urgent"],
    queryFn: () =>
      testOrdersApi
        .findAllImmuno({ page: 0, size: 1, isUrgent: true })
        .then((r) => r.data.totalElements),
  });

  const orders = data?.content ?? [];
  const pageCount = data?.totalPages ?? 0;
  const contracts = contractsData ?? [];
  const doctors = doctorsData ?? [];

  const deleteMutation = useMutation({
    mutationFn: (id: string) => testOrdersApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["test-orders-immuno"] });
      toast.success("Demande supprimée avec succès");
      setDeleteTarget(null);
    },
    onError: (err: AxiosError<ApiError>) => {
      toast.error(
        err.response?.data?.message ?? "Erreur lors de la suppression"
      );
    },
  });

  // --- Colonnes (ordre exact index2.blade.php)
  const columns: ColumnDef<TestOrder>[] = [
    // 1. Actions — PREMIÈRE colonne comme Laravel
    {
      header: "Actions",
      id: "actions",
      cell: ({ row }) => (
        <ActionButtons order={row.original} onDelete={setDeleteTarget} />
      ),
    },
    // 2. Date
    {
      header: "Date",
      accessorKey: "createdAt",
      cell: ({ getValue }) => formatDate(getValue<string>()),
    },
    // 3. Code
    {
      header: "Code",
      accessorKey: "code",
      cell: ({ row }) =>
        row.original.code ?? (
          <span className="text-gray-400 italic text-xs">En attente</span>
        ),
    },
    // 4. Affecter à — dropdown docteur
    {
      header: "Affecter à",
      id: "affecter",
      cell: ({ row }) => (
        <AttribuateSelect order={row.original} doctors={doctors} />
      ),
    },
    // 5. Patient
    {
      header: "Patient",
      id: "patient",
      cell: ({ row }) =>
        `${row.original.patientFirstname} ${row.original.patientLastname}`,
    },
    // 6. Examens
    {
      header: "Examens",
      id: "tests",
      cell: ({ row }) => (
        <div className="text-xs text-gray-700 max-w-[160px]">
          {row.original.details?.length
            ? row.original.details.map((d) => (
                <div key={d.id ?? `${row.original.id}-${d.labTestId}`}>
                  {d.testName}
                </div>
              ))
            : "—"}
        </div>
      ),
    },
    // 7. Contrat
    {
      header: "Contrat",
      accessorKey: "contratName",
      cell: ({ row }) => row.original.contratName ?? "—",
    },
    // 8. Montant
    {
      header: "Montant",
      id: "amount",
      cell: ({ row }) => formatCFA(row.original.total),
    },
    // 9. Compte rendu — badge bleu "Valider" / gris "En attente"
    {
      header: "Compte rendu",
      id: "report",
      cell: ({ row }) => {
        const status = row.original.reportStatus;
        const isValidated =
          status === "VALIDATED" || status === "DELIVERED";
        return (
          <span
            className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium text-white ${
              isValidated ? "bg-blue-600" : "bg-gray-500"
            }`}
          >
            {isValidated ? "Valider" : "En attente"}
          </span>
        );
      },
    },
    // 10. Urgent — badge rouge si urgent
    {
      header: "Urgent",
      id: "urgent",
      cell: ({ row }) =>
        row.original.isUrgent ? (
          <span className="inline-flex items-center rounded-full bg-red-600 px-2 py-0.5 text-xs font-medium text-white">
            Urgent
          </span>
        ) : (
          <span className="text-gray-400 text-xs">—</span>
        ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Demandes d'examen IMMUNO"
        breadcrumbs={[
          { label: "Accueil", href: "/home" },
          { label: "Demandes d'examen IMMUNO" },
        ]}
        action={
          can(PERMISSIONS.CREATE_TEST_ORDERS) ? (
            <Link
              href="/test-orders/create"
              className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700"
            >
              <Plus className="h-4 w-4" />
              Ajouter une nouvelle demande d'examen
            </Link>
          ) : undefined
        }
      />

      <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">

        {/* Filtres — rangée 1 (sans Type d'examen) */}
        <div className="mb-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">Contrat</label>
            <select
              value={contratFilter}
              onChange={(e) => { setContratFilter(e.target.value); setPage(0); }}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="">Tous les contrats</option>
              {contracts.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">Status</label>
            <select
              value={statusFilter}
              onChange={(e) => { setStatusFilter(e.target.value); setPage(0); }}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="">Tous</option>
              <option value="VALIDATED">Valider</option>
              <option value="PENDING">En attente</option>
              <option value="DELIVERED">Livrer</option>
              <option value="CANCELLED">Non Livrer</option>
            </select>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">Urgent</label>
            <select
              value={urgentFilter}
              onChange={(e) => { setUrgentFilter(e.target.value); setPage(0); }}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="">Tous</option>
              <option value="1">Urgent</option>
            </select>
          </div>
        </div>

        {/* Filtres — rangée 2 */}
        <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">Docteur</label>
            <select
              value={docteurFilter}
              onChange={(e) => { setDocteurFilter(e.target.value); setPage(0); }}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="">Tous</option>
              {doctors.map((d) => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">Rechercher</label>
            <input
              type="text"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(0); }}
              placeholder="Code, patient..."
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">Date Début</label>
            <input
              type="date"
              value={dateBegin}
              onChange={(e) => { setDateBegin(e.target.value); setPage(0); }}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">Date fin</label>
            <input
              type="date"
              value={dateEnd}
              onChange={(e) => { setDateEnd(e.target.value); setPage(0); }}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
        </div>

        {/* Barre de statistiques (Livrer / Valider / Cas urgent) */}
        <div className="mb-4 flex flex-wrap gap-3">
          <div className="rounded-full bg-green-100 px-4 py-1.5 text-sm font-medium text-green-800 ring-1 ring-green-300">
            Livrer : {statsLivrer ?? "…"}
          </div>
          <div className="rounded-full bg-yellow-100 px-4 py-1.5 text-sm font-medium text-yellow-800 ring-1 ring-yellow-300">
            Valider : {statsValider ?? "…"}
          </div>
          <div className="rounded-full bg-red-100 px-4 py-1.5 text-sm font-medium text-red-800 ring-1 ring-red-300">
            Cas urgent : {statsUrgent ?? "…"}
          </div>
        </div>

        {/* Tableau */}
        <DataTable
          columns={columns}
          data={orders}
          isLoading={isLoading}
          pageCount={pageCount}
          pageIndex={page}
          pageSize={pageSize}
          onPageChange={setPage}
          onPageSizeChange={(size) => { setPageSize(size); setPage(0); }}
          rowClassName={(row) => (row.isUrgent ? "bg-red-50" : "")}
        />
      </div>

      <ConfirmModal
        isOpen={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => { if (deleteTarget) deleteMutation.mutate(deleteTarget.id); }}
        title="Supprimer cette demande d'examen"
        message="La suppression d'un examen entraîne la suppression du Rapport. Voulez-vous continuer ?"
        confirmLabel="Oui"
        confirmVariant="danger"
        isLoading={deleteMutation.isPending}
      />
    </div>
  );
}
