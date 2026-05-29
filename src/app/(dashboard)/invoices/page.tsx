"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Eye,
  Trash2,
  Plus,
  CreditCard,
  CheckCircle,
  XCircle,
  Search,
  Clock,
} from "lucide-react";
import { toast } from "sonner";
import type { AxiosError } from "axios";
import type { ColumnDef } from "@tanstack/react-table";

import { DataTable } from "@/components/common/DataTable";
import { ConfirmModal } from "@/components/common/ConfirmModal";
import { PageHeader } from "@/components/ui/PageHeader";
import { usePermissions } from "@/hooks/usePermissions";
import { PERMISSIONS } from "@/lib/constants/permissions";
import { formatDate, cn } from "@/lib/utils";
import { invoicesApi, type Invoice } from "@/lib/api/invoices";
import type { ApiError } from "@/types/api";

// ---------------------------------------------------------------------------
// Formatage montant FCFA
// ---------------------------------------------------------------------------

function formatFCFA(amount: number): string {
  return new Intl.NumberFormat("fr-FR").format(amount) + " FCFA";
}

// ---------------------------------------------------------------------------
// Badge statut paiement (Payé vert / En attente orange)
// ---------------------------------------------------------------------------

function PaidBadge({ paid }: { paid: boolean }) {
  if (paid) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
        <CheckCircle className="h-3 w-3" />
        Payé
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-orange-100 px-2 py-0.5 text-xs font-medium text-orange-700">
      <Clock className="h-3 w-3" />
      En attente
    </span>
  );
}

// ---------------------------------------------------------------------------
// Badge MECeF
// ---------------------------------------------------------------------------

function MecefBadge({ code }: { code?: string }) {
  if (code) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
        <CheckCircle className="h-3 w-3" />
        {code}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">
      <XCircle className="h-3 w-3" />
      Non sync
    </span>
  );
}

// ---------------------------------------------------------------------------
// Libellé méthode de paiement
// ---------------------------------------------------------------------------

function paymentLabel(payment?: string): string {
  switch (payment) {
    case "ESPECES":
      return "Espèces";
    case "MOBILEMONEY":
      return "Mobile Money";
    case "CARTEBANCAIRE":
      return "Carte bancaire";
    case "CHEQUES":
      return "Chèque";
    case "VIREMENT":
      return "Virement";
    case "CREDIT":
      return "Crédit";
    case "AUTRE":
      return "Autre";
    default:
      return "—";
  }
}

// ---------------------------------------------------------------------------
// Mois en français pour le sélecteur Rapports
// ---------------------------------------------------------------------------

const MONTHS_FR: { value: number; label: string }[] = [
  { value: 1, label: "Janvier" },
  { value: 2, label: "Février" },
  { value: 3, label: "Mars" },
  { value: 4, label: "Avril" },
  { value: 5, label: "Mai" },
  { value: 6, label: "Juin" },
  { value: 7, label: "Juillet" },
  { value: 8, label: "Août" },
  { value: 9, label: "Septembre" },
  { value: 10, label: "Octobre" },
  { value: 11, label: "Novembre" },
  { value: 12, label: "Décembre" },
];

// ---------------------------------------------------------------------------
// Boutons d'action ligne
// ---------------------------------------------------------------------------

function ActionButtons({
  invoice,
  onDelete,
  onPay,
  canManage,
  canDelete,
}: {
  invoice: Invoice;
  onDelete: (invoice: Invoice) => void;
  onPay: (invoice: Invoice) => void;
  canManage: boolean;
  canDelete: boolean;
}) {
  return (
    <div className="flex items-center gap-1">
      <Link
        href={`/invoices/${invoice.id}`}
        className="inline-flex items-center justify-center rounded p-1.5 text-white bg-blue-600 hover:bg-blue-700 transition-colors"
        title="Voir la facture"
      >
        <Eye className="h-4 w-4" />
      </Link>

      {canManage && !invoice.paid && (
        <button
          type="button"
          onClick={() => onPay(invoice)}
          className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs font-medium bg-blue-600 text-white hover:bg-blue-700 transition-colors"
          title="Payer"
        >
          <CreditCard className="h-3.5 w-3.5" />
          Payer
        </button>
      )}

      {canDelete && (
        <button
          type="button"
          onClick={() => onDelete(invoice)}
          className="inline-flex items-center justify-center rounded p-1.5 text-white bg-red-600 hover:bg-red-700 transition-colors"
          title="Supprimer"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page principale
// ---------------------------------------------------------------------------

type TabKey = "list" | "reports";

export default function InvoicesPage() {
  const { can } = usePermissions();
  const queryClient = useQueryClient();

  // Onglet actif
  const [activeTab, setActiveTab] = useState<TabKey>("list");

  // Pagination
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(10);

  // Filtres liste
  const [paidFilter, setPaidFilter] = useState("");
  const [statusInvoiceFilter, setStatusInvoiceFilter] = useState("");
  const [search, setSearch] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  // Filtres rapports
  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth() + 1;
  const [reportYear, setReportYear] = useState<number>(currentYear);
  const [reportMonth, setReportMonth] = useState<number>(currentMonth);
  // Année/mois appliqués (déclenchés par "Filtrer")
  const [appliedYear, setAppliedYear] = useState<number>(currentYear);
  const [appliedMonth, setAppliedMonth] = useState<number>(currentMonth);

  // Suppression
  const [deleteTarget, setDeleteTarget] = useState<Invoice | null>(null);

  // --- Query : liste des factures
  const { data, isLoading } = useQuery({
    queryKey: [
      "invoices",
      {
        page,
        size: pageSize,
        paidFilter,
        statusInvoiceFilter,
        search,
        startDate,
        endDate,
      },
    ],
    queryFn: () =>
      invoicesApi
        .findAll({
          page,
          size: pageSize,
          paid: paidFilter !== "" ? paidFilter : undefined,
          statusInvoice:
            statusInvoiceFilter !== "" ? Number(statusInvoiceFilter) : undefined,
          search: search || undefined,
          startDate: startDate || undefined,
          endDate: endDate || undefined,
        })
        .then((r) => r.data),
    enabled: activeTab === "list",
  });

  // --- Query : stats du jour (badge total encaissé)
  const { data: todayStats } = useQuery({
    queryKey: ["invoices", "stats", "today"],
    queryFn: () => invoicesApi.getTodayStats().then((r) => r.data),
  });

  // --- Query : counts (ventes / avoirs)
  const { data: counts } = useQuery({
    queryKey: ["invoices", "counts"],
    queryFn: () => invoicesApi.getCounts().then((r) => r.data),
    enabled: activeTab === "list",
  });

  // --- Query : rapport mensuel
  const { data: report, isLoading: isReportLoading } = useQuery({
    queryKey: ["invoices", "reports", appliedYear, appliedMonth],
    queryFn: () =>
      invoicesApi.getReports(appliedYear, appliedMonth).then((r) => r.data),
    enabled: activeTab === "reports",
  });

  const invoices = data?.content ?? [];
  const pageCount = data?.totalPages ?? 0;

  // --- Mutation suppression
  const deleteMutation = useMutation({
    mutationFn: (id: string) => invoicesApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
      toast.success("Facture supprimée avec succès");
      setDeleteTarget(null);
    },
    onError: (err: AxiosError<ApiError>) => {
      toast.error(err.response?.data?.message ?? "Erreur lors de la suppression");
    },
  });

  // --- Mutation paiement rapide (espèces par défaut)
  const payMutation = useMutation({
    mutationFn: (id: string) =>
      invoicesApi.markAsPaid(id, { payment: "ESPECES" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
      toast.success("Facture marquée comme payée");
    },
    onError: (err: AxiosError<ApiError>) => {
      toast.error(err.response?.data?.message ?? "Erreur lors du paiement");
    },
  });

  if (!can(PERMISSIONS.VIEW_INVOICES)) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-gray-500">Accès non autorisé</p>
      </div>
    );
  }

  // --- Colonnes du tableau (Date / Demande / Patient / Contrat / Total / Code normalisé / Type paiement / Statut / Actions)
  const columns: ColumnDef<Invoice>[] = [
    {
      header: "Date",
      accessorKey: "createdAt",
      enableSorting: true,
      cell: ({ getValue }) => (
        <span className="text-xs text-gray-500">{formatDate(getValue<string>())}</span>
      ),
    },
    {
      header: "Demande",
      id: "testOrder",
      accessorFn: (row) => row.testOrderCode ?? "",
      enableSorting: true,
      cell: ({ row }) =>
        row.original.testOrderCode ? (
          <span className="font-mono text-xs text-gray-600">
            {row.original.testOrderCode}
          </span>
        ) : (
          <span className="text-gray-400 text-xs">—</span>
        ),
    },
    {
      header: "Patient",
      id: "patient",
      accessorFn: (row) => row.patientName ?? "",
      enableSorting: true,
      cell: ({ row }) => {
        const name = row.original.patientName;
        if (!name) return <span className="text-gray-400 text-xs">—</span>;
        return <span className="text-sm font-medium text-gray-800">{name}</span>;
      },
    },
    {
      header: "Contrat",
      id: "contrat",
      accessorFn: (row) => row.contratName ?? "",
      enableSorting: true,
      cell: ({ row }) =>
        row.original.contratName ? (
          <span className="text-sm text-gray-700">{row.original.contratName}</span>
        ) : (
          <span className="text-gray-400 text-xs">—</span>
        ),
    },
    {
      header: "Total",
      accessorKey: "total",
      enableSorting: true,
      cell: ({ row }) => (
        <span className="text-sm font-medium text-gray-800">
          {formatFCFA(row.original.total)}
        </span>
      ),
    },
    {
      header: "Code normalisé",
      id: "mecef",
      accessorFn: (row) => row.codeMecef ?? "",
      enableSorting: true,
      cell: ({ row }) => <MecefBadge code={row.original.codeMecef} />,
    },
    {
      header: "Type de paiement",
      accessorKey: "payment",
      enableSorting: true,
      cell: ({ row }) => (
        <span className="text-sm text-gray-600">
          {paymentLabel(row.original.payment)}
        </span>
      ),
    },
    {
      header: "Statut",
      id: "paid",
      accessorFn: (row) => (row.paid ? "Payé" : "En attente"),
      enableSorting: true,
      cell: ({ row }) => <PaidBadge paid={row.original.paid} />,
    },
    {
      header: "Actions",
      id: "actions",
      enableSorting: false,
      cell: ({ row }) => (
        <ActionButtons
          invoice={row.original}
          onDelete={setDeleteTarget}
          onPay={(inv) => payMutation.mutate(inv.id)}
          canManage={can(PERMISSIONS.MANAGE_FINANCE)}
          canDelete={can(PERMISSIONS.DELETE_INVOICES)}
        />
      ),
    },
  ];

  // Années disponibles (année courante - 5 ans)
  const years = Array.from({ length: 6 }, (_, i) => currentYear - i);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Factures"
        breadcrumbs={[
          { label: "Accueil", href: "/home" },
          { label: "Factures" },
        ]}
        action={
          <div className="flex items-center gap-3">
            <span className="inline-flex items-center rounded-full bg-green-100 px-3 py-1.5 text-sm font-semibold text-green-700">
              Total encaissé : {formatFCFA(todayStats?.totalToday ?? 0)}
            </span>
            {can(PERMISSIONS.CREATE_INVOICES) && (
              <Link
                href="/invoices/create"
                className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700"
              >
                <Plus className="h-4 w-4" />
                Ajouter une nouvelle facture
              </Link>
            )}
          </div>
        }
      />

      {/* Onglets pill */}
      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={() => setActiveTab("list")}
          className={cn(
            "rounded-full border px-5 py-2 text-sm font-medium transition-colors",
            activeTab === "list"
              ? "bg-green-100 text-green-700 border-green-300"
              : "bg-gray-100 text-gray-700 border-transparent hover:bg-gray-200"
          )}
        >
          Liste des factures
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("reports")}
          className={cn(
            "rounded-full border px-5 py-2 text-sm font-medium transition-colors",
            activeTab === "reports"
              ? "bg-green-100 text-green-700 border-green-300"
              : "bg-gray-100 text-gray-700 border-transparent hover:bg-gray-200"
          )}
        >
          Rapports
        </button>
      </div>

      {/* === Onglet 1 : Liste === */}
      {activeTab === "list" && (
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          {/* Carte filtres (5 champs) */}
          <div className="mb-4 grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-5">
            {/* Rechercher */}
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600">
                Rechercher
              </label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setPage(0);
                  }}
                  placeholder="Par code d'examen ou patient..."
                  className="w-full rounded-md border border-gray-300 pl-9 pr-3 py-2 text-sm shadow-sm placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
            </div>

            {/* Statut paiement */}
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600">
                Statut
              </label>
              <select
                value={paidFilter}
                onChange={(e) => {
                  setPaidFilter(e.target.value);
                  setPage(0);
                }}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option value="">Tous</option>
                <option value="false">En attente</option>
                <option value="true">Payé</option>
              </select>
            </div>

            {/* Type de facture (vente/avoir) */}
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600">
                Type de facture
              </label>
              <select
                value={statusInvoiceFilter}
                onChange={(e) => {
                  setStatusInvoiceFilter(e.target.value);
                  setPage(0);
                }}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option value="">Tous</option>
                <option value="0">Facture de vente</option>
                <option value="1">Facture d&apos;avoir</option>
              </select>
            </div>

            {/* Date début */}
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600">
                Date Début
              </label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => {
                  setStartDate(e.target.value);
                  setPage(0);
                }}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>

            {/* Date fin */}
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600">
                Date fin
              </label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => {
                  setEndDate(e.target.value);
                  setPage(0);
                }}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* 2 badges compteurs */}
          <div className="mb-4 flex flex-wrap gap-3">
            <span className="inline-flex items-center rounded-full bg-gray-100 px-4 py-1.5 text-sm font-medium text-gray-700">
              Factures de vente : {counts?.sales ?? 0}
            </span>
            <span className="inline-flex items-center rounded-full bg-red-100 px-4 py-1.5 text-sm font-medium text-red-700">
              Factures d&apos;avoir : {counts?.credits ?? 0}
            </span>
          </div>

          {/* Tableau */}
          <DataTable
            columns={columns}
            data={invoices}
            isLoading={isLoading}
            pageCount={pageCount}
            pageIndex={page}
            pageSize={pageSize}
            onPageChange={setPage}
            onPageSizeChange={(size) => {
              setPageSize(size);
              setPage(0);
            }}
            rowClassName={(row) =>
              row.statusInvoice === 1 ? "bg-red-50" : ""
            }
          />
        </div>
      )}

      {/* === Onglet 2 : Rapports === */}
      {activeTab === "reports" && (
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          {/* Filtres */}
          <div className="mb-5 grid grid-cols-1 items-end gap-3 md:grid-cols-4">
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600">
                Année
              </label>
              <select
                value={reportYear}
                onChange={(e) => setReportYear(Number(e.target.value))}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                {years.map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600">
                Mois
              </label>
              <select
                value={reportMonth}
                onChange={(e) => setReportMonth(Number(e.target.value))}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                {MONTHS_FR.map((m) => (
                  <option key={m.value} value={m.value}>
                    {m.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <button
                type="button"
                onClick={() => {
                  setAppliedYear(reportYear);
                  setAppliedMonth(reportMonth);
                }}
                className="inline-flex items-center gap-2 rounded-lg bg-green-600 px-5 py-2 text-sm font-medium text-white transition-colors hover:bg-green-700"
              >
                Filtrer
              </button>
            </div>
          </div>

          {/* Tableau rapports */}
          <div className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-600">
                      Période
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-600">
                      Factures de ventes
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-600">
                      Factures d&apos;avoirs
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-600">
                      Chiffre d&apos;affaires
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-600">
                      Encaissements
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {isReportLoading ? (
                    <tr>
                      <td
                        colSpan={5}
                        className="px-4 py-8 text-center text-sm text-gray-500"
                      >
                        Chargement…
                      </td>
                    </tr>
                  ) : !report ? (
                    <tr>
                      <td
                        colSpan={5}
                        className="px-4 py-8 text-center text-sm text-gray-500"
                      >
                        Aucune donnée
                      </td>
                    </tr>
                  ) : (
                    <tr>
                      <td className="px-4 py-3 align-top text-sm font-medium text-gray-800">
                        {report.period}
                      </td>
                      <td className="px-4 py-3 align-top text-sm text-gray-700">
                        <div className="font-semibold">
                          Total : {formatFCFA(report.totalSales)}
                        </div>
                        {report.byContracts && report.byContracts.length > 0 && (
                          <ul className="mt-1 space-y-0.5 text-xs text-gray-600">
                            {report.byContracts.map((c, idx) => (
                              <li key={idx}>
                                {c.contractName} : {formatFCFA(c.total)}
                              </li>
                            ))}
                          </ul>
                        )}
                      </td>
                      <td className="px-4 py-3 align-top text-sm text-gray-700">
                        <div className="font-semibold">
                          Total : {formatFCFA(report.totalCredits)}
                        </div>
                      </td>
                      <td className="px-4 py-3 align-top text-sm text-gray-700">
                        <div className="font-semibold">
                          Total : {formatFCFA(report.turnover)}
                        </div>
                      </td>
                      <td className="px-4 py-3 align-top text-sm text-gray-700">
                        <div className="font-semibold">
                          Total : {formatFCFA(report.collections)}
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Modal confirmation suppression */}
      <ConfirmModal
        isOpen={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => {
          if (deleteTarget) deleteMutation.mutate(deleteTarget.id);
        }}
        title="Supprimer cette facture"
        message="La suppression est irréversible. Voulez-vous vraiment supprimer cette facture ?"
        confirmLabel="Supprimer"
        confirmVariant="danger"
        isLoading={deleteMutation.isPending}
      />
    </div>
  );
}
