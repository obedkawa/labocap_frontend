"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { Eye } from "lucide-react";
import type { ColumnDef } from "@tanstack/react-table";

import { DataTable } from "@/components/common/DataTable";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatCard } from "@/components/ui/StatCard";
import { Badge } from "@/components/ui/Badge";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { formatDate } from "@/lib/utils";
import {
  testOrdersApi,
  type TestOrder,
  type MySpaceStats,
} from "@/lib/api/testOrders";
import { typeOrdersApi, type TypeOrder } from "@/lib/api/examens";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import type { PageResponse } from "@/types/api";

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function MySpacePage() {
  const { user } = useCurrentUser();

  // ---- Filtres — en attente
  const [pendingTypeOrderId, setPendingTypeOrderId] = useState("");
  const [pendingPriority, setPendingPriority] = useState("");
  const [pendingPage, setPendingPage] = useState(0);
  const [pendingPageSize, setPendingPageSize] = useState(10);

  // ---- Filtres — terminées
  const [doneTypeOrderId, setDoneTypeOrderId] = useState("");
  const [donePriority, setDonePriority] = useState("");
  const [donePage, setDonePage] = useState(0);
  const [donePageSize, setDonePageSize] = useState(10);

  // ---------------------------------------------------------------------------
  // Queries
  // ---------------------------------------------------------------------------

  const { data: stats, isLoading: statsLoading } = useQuery<MySpaceStats>({
    queryKey: ["myspace-stats"],
    queryFn: () => testOrdersApi.getMySpace().then((r) => r.data),
  });

  const { data: typeOrdersData } = useQuery<TypeOrder[]>({
    queryKey: ["type-orders-all"],
    queryFn: () => typeOrdersApi.findAll().then((r) => r.data),
  });
  const typeOrders: TypeOrder[] = typeOrdersData ?? [];

  const { data: pendingData, isLoading: pendingLoading } =
    useQuery<PageResponse<TestOrder>>({
      queryKey: [
        "myspace-pending",
        { typeOrderId: pendingTypeOrderId, priority: pendingPriority, page: pendingPage, size: pendingPageSize },
      ],
      queryFn: () =>
        testOrdersApi
          .getMyOrders({
            status: "PENDING",
            typeOrderId: pendingTypeOrderId || undefined,
            priority: pendingPriority || undefined,
            page: pendingPage,
            size: pendingPageSize,
          })
          .then((r) => r.data),
    });

  const { data: doneData, isLoading: doneLoading } =
    useQuery<PageResponse<TestOrder>>({
      queryKey: [
        "myspace-done",
        { typeOrderId: doneTypeOrderId, priority: donePriority, page: donePage, size: donePageSize },
      ],
      queryFn: () =>
        testOrdersApi
          .getMyOrders({
            status: "VALIDATED",
            typeOrderId: doneTypeOrderId || undefined,
            priority: donePriority || undefined,
            page: donePage,
            size: donePageSize,
          })
          .then((r) => r.data),
    });

  const pendingOrders: TestOrder[] = pendingData?.content ?? [];
  const doneOrders: TestOrder[] = doneData?.content ?? [];

  // ---------------------------------------------------------------------------
  // Colonnes DataTable
  // ---------------------------------------------------------------------------

  const buildColumns = (): ColumnDef<TestOrder>[] => [
    {
      header: "Actions",
      id: "actions",
      cell: ({ row }) => (
        <Link
          href={`/test-orders/${row.original.id}/details`}
          className="inline-flex items-center justify-center rounded p-1.5 text-gray-500 hover:bg-gray-100 hover:text-blue-600 transition-colors"
          title="Voir les détails"
        >
          <Eye className="h-4 w-4" />
        </Link>
      ),
    },
    {
      header: "Date",
      id: "date",
      cell: ({ row }) =>
        row.original.prelevementDate ? formatDate(row.original.prelevementDate) : formatDate(row.original.createdAt),
    },
    {
      header: "Code",
      accessorKey: "code",
    },
    {
      header: "Patient",
      id: "patient",
      cell: ({ row }) =>
        `${row.original.patientFirstname} ${row.original.patientLastname}`,
    },
    {
      header: "Examens",
      id: "examens",
      cell: ({ row }) => row.original.typeOrderTitle ?? "—",
    },
    {
      header: "Contrat",
      id: "contrat",
      cell: ({ row }) => row.original.contratName ?? "—",
    },
    {
      header: "Statut",
      id: "report",
      cell: ({ row }) => {
        if (!row.original.status) return <span className="text-gray-400 text-xs">—</span>;
        return (
          <StatusBadge status={row.original.status} domain="testOrder" />
        );
      },
    },
    {
      header: "Urgent",
      id: "urgent",
      cell: ({ row }) =>
        row.original.isUrgent ? (
          <Badge variant="danger">Urgent</Badge>
        ) : (
          <Badge variant="secondary">Normal</Badge>
        ),
    },
  ];

  const pendingColumns = buildColumns();
  const doneColumns = buildColumns();

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  const fullName = user
    ? `${user.firstname ?? ""} ${user.lastname ?? ""}`.trim()
    : "";

  return (
    <div className="space-y-8">
      <PageHeader
        title={`Mon espace [ ${fullName} ]`}
        breadcrumbs={[{ label: "Mon espace" }]}
      />

      {/* =================================================================
          KPI widgets
      ================================================================= */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        <StatCard
          title="DEMANDES AFFECTÉES"
          value={statsLoading ? "…" : (stats?.totalAssigned ?? 0)}
        />
        <StatCard
          title="DEMANDES EN ATTENTE"
          value={statsLoading ? "…" : (stats?.totalPending ?? 0)}
        />
        <StatCard
          title="DEMANDES VALIDÉES"
          value={statsLoading ? "…" : (stats?.totalValidated ?? 0)}
        />
        <StatCard
          title="DEMANDES URGENTES"
          value={statsLoading ? "…" : (stats?.totalUrgent ?? 0)}
          valueClassName="text-red-600"
        />
        <StatCard
          title="DEMANDES EN RETARD"
          value={statsLoading ? "…" : (stats?.totalLate ?? 0)}
          valueClassName="text-red-600"
        />
      </div>

      {/* =================================================================
          DataTable 1 — Demandes en attente
      ================================================================= */}
      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <h2 className="text-base font-semibold text-gray-800 mb-4">
          Demandes en attente
        </h2>

        {/* Filtres */}
        <div className="flex flex-wrap gap-3 mb-4">
          <select
            value={pendingTypeOrderId}
            onChange={(e) => {
              setPendingTypeOrderId(e.target.value);
              setPendingPage(0);
            }}
            className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            <option value="">Tous les types</option>
            {typeOrders.map((t) => (
              <option key={t.id} value={t.id}>
                {t.title}
              </option>
            ))}
          </select>

          <select
            value={pendingPriority}
            onChange={(e) => {
              setPendingPriority(e.target.value);
              setPendingPage(0);
            }}
            className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            <option value="">Tous</option>
            <option value="urgent">Urgent</option>
            <option value="late">Retard</option>
          </select>
        </div>

        <DataTable<TestOrder>
          columns={pendingColumns}
          data={pendingOrders}
          isLoading={pendingLoading}
          pageCount={pendingData?.totalPages ?? 0}
          pageIndex={pendingPage}
          pageSize={pendingPageSize}
          onPageChange={setPendingPage}
          onPageSizeChange={(size) => {
            setPendingPageSize(size);
            setPendingPage(0);
          }}
        />
      </div>

      {/* =================================================================
          DataTable 2 — Demandes terminées
      ================================================================= */}
      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <h2 className="text-base font-semibold text-gray-800 mb-4">
          Demandes terminées
        </h2>

        {/* Filtres */}
        <div className="flex flex-wrap gap-3 mb-4">
          <select
            value={doneTypeOrderId}
            onChange={(e) => {
              setDoneTypeOrderId(e.target.value);
              setDonePage(0);
            }}
            className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            <option value="">Tous les types</option>
            {typeOrders.map((t) => (
              <option key={t.id} value={t.id}>
                {t.title}
              </option>
            ))}
          </select>

          <select
            value={donePriority}
            onChange={(e) => {
              setDonePriority(e.target.value);
              setDonePage(0);
            }}
            className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            <option value="">Tous</option>
            <option value="urgent">Urgent</option>
            <option value="late">Retard</option>
          </select>
        </div>

        <DataTable<TestOrder>
          columns={doneColumns}
          data={doneOrders}
          isLoading={doneLoading}
          pageCount={doneData?.totalPages ?? 0}
          pageIndex={donePage}
          pageSize={donePageSize}
          onPageChange={setDonePage}
          onPageSizeChange={(size) => {
            setDonePageSize(size);
            setDonePage(0);
          }}
        />
      </div>
    </div>
  );
}
