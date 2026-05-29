"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { Eye } from "lucide-react";
import type { ColumnDef } from "@tanstack/react-table";

import { PageHeader } from "@/components/ui/PageHeader";
import { DataTable } from "@/components/common/DataTable";
import { PermissionGate } from "@/components/common/PermissionGate";
import { PERMISSIONS } from "@/lib/constants/permissions";
import { cashboxApi, CashboxDailyResponseDto } from "@/lib/api/cashbox";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatFCFA(amount: number | null | undefined) {
  if (amount === undefined || amount === null) return "—";
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "XOF",
    minimumFractionDigits: 0,
  }).format(amount);
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function statusBadge(status: number) {
  if (status === 0) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
        <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
        Ouverte
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">
      <span className="h-1.5 w-1.5 rounded-full bg-gray-400" />
      Clôturée
    </span>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function CashboxSessionsPage() {
  const [pageIndex, setPageIndex] = useState(0);
  const [pageSize, setPageSize] = useState(10);
  const [dateFilter, setDateFilter] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["cashbox-dailies", pageIndex, pageSize, dateFilter],
    queryFn: () =>
      cashboxApi
        .getDailies({
          page: pageIndex,
          size: pageSize,
          ...(dateFilter ? { date: dateFilter } : {}),
        })
        .then((r) => r.data),
  });

  const sessions: CashboxDailyResponseDto[] = data?.content ?? [];
  const totalPages = data?.totalPages ?? 0;

  // ---- Colonnes ----
  const columns: ColumnDef<CashboxDailyResponseDto>[] = [
    {
      header: "Code",
      accessorKey: "code",
      cell: ({ row }) => (
        <span className="font-mono text-xs text-gray-700">
          {row.original.code}
        </span>
      ),
    },
    {
      header: "Date",
      accessorKey: "date",
      cell: ({ row }) => formatDate(row.original.date),
    },
    {
      header: "Solde ouverture",
      accessorKey: "openingBalance",
      cell: ({ row }) => formatFCFA(row.original.openingBalance),
    },
    {
      header: "Solde fermeture",
      accessorKey: "closingBalance",
      cell: ({ row }) => formatFCFA(row.original.closingBalance),
    },
    {
      header: "Total calculé",
      accessorKey: "totalCalculated",
      cell: ({ row }) => formatFCFA(row.original.totalCalculated),
    },
    {
      header: "Statut",
      accessorKey: "status",
      cell: ({ row }) => statusBadge(row.original.status),
    },
    {
      header: "Actions",
      id: "actions",
      cell: ({ row }) => (
        <Link
          href={`/cashbox/sessions/${row.original.id}`}
          className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs font-medium bg-blue-50 text-blue-700 hover:bg-blue-100 transition-colors"
          aria-label="Voir le détail"
        >
          <Eye className="h-3.5 w-3.5" />
          Voir
        </Link>
      ),
    },
  ];

  // ---- Render ----
  return (
    <PermissionGate
      permission={PERMISSIONS.VIEW_CASHBOX_DAILIES}
      fallback={
        <div className="flex h-64 items-center justify-center text-sm text-gray-500">
          Vous n&apos;avez pas accès à l&apos;historique des sessions.
        </div>
      }
    >
      <div className="space-y-6">
        <PageHeader
          title="Sessions journalières"
          subtitle="Historique des ouvertures et fermetures de caisse"
          breadcrumbs={[
            { label: "Trésorerie" },
            { label: "Caisse de vente", href: "/cashbox" },
            { label: "Sessions" },
          ]}
        />

        <div className="rounded-xl border border-gray-200 bg-white shadow-sm p-5">
          {/* Filtre date */}
          <div className="mb-4 flex items-center gap-3">
            <label
              htmlFor="date-filter"
              className="text-sm font-medium text-gray-700"
            >
              Filtrer par date :
            </label>
            <input
              id="date-filter"
              type="date"
              value={dateFilter}
              onChange={(e) => {
                setDateFilter(e.target.value);
                setPageIndex(0);
              }}
              className="rounded-md border border-gray-300 px-3 py-1.5 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
            {dateFilter && (
              <button
                onClick={() => {
                  setDateFilter("");
                  setPageIndex(0);
                }}
                className="text-sm text-gray-500 hover:text-gray-700 underline"
              >
                Réinitialiser
              </button>
            )}
          </div>

          <DataTable
            columns={columns}
            data={sessions}
            isLoading={isLoading}
            pageCount={totalPages}
            pageIndex={pageIndex}
            pageSize={pageSize}
            onPageChange={setPageIndex}
            onPageSizeChange={(s) => {
              setPageSize(s);
              setPageIndex(0);
            }}
          />
        </div>
      </div>
    </PermissionGate>
  );
}
