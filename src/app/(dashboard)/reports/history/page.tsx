"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import type { ColumnDef } from "@tanstack/react-table";

import { PageHeader } from "@/components/ui/PageHeader";
import { DataTable } from "@/components/common/DataTable";
import { usePermissions } from "@/hooks/usePermissions";
import { PERMISSIONS } from "@/lib/constants/permissions";
import { reportsApi, type LogReportRow } from "@/lib/api/reports";
import type { PageResponse } from "@/types/api";
import { formatDateTime } from "@/lib/utils";

export default function ReportHistoryPage() {
  const { can } = usePermissions();
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(20);

  const { data, isLoading } = useQuery<PageResponse<LogReportRow>>({
    queryKey: ["report-logs", { page, size: pageSize }],
    queryFn: () =>
      reportsApi.getLogs({ page, size: pageSize }).then((r) => r.data),
  });

  const logs = data?.content ?? [];
  const pageCount = data?.totalPages ?? 0;

  const columns: ColumnDef<LogReportRow>[] = [
    {
      header: "Date",
      id: "date",
      cell: ({ row }) => (
        <span className="whitespace-nowrap text-sm text-gray-700">
          {row.original.date ? formatDateTime(row.original.date) : "—"}
        </span>
      ),
    },
    {
      header: "Compte rendu",
      id: "report",
      cell: ({ row }) => {
        const code = row.original.reportCode ?? row.original.testOrderCode;
        return (
          <span className="font-mono text-sm text-gray-700">
            {code ?? "Aucun"}
          </span>
        );
      },
    },
    {
      header: "Opération",
      accessorKey: "action",
      cell: ({ row }) => {
        const action = row.original.action?.trim();
        if (!action) return <span className="text-gray-300">—</span>;
        return (
          <span className="inline-flex items-center rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700">
            {action}
          </span>
        );
      },
    },
    {
      header: "Utilisateur",
      id: "user",
      cell: ({ row }) => row.original.userFullName ?? "—",
    },
  ];

  if (!can(PERMISSIONS.VIEW_REPORTS)) {
    return (
      <div className="flex h-64 items-center justify-center">
        <p className="text-gray-500">Accès non autorisé</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Historique des comptes rendu"
        subtitle="Journal des actions effectuées sur les comptes-rendus"
        action={
          <Link
            href="/reports"
            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700"
          >
            <ArrowLeft className="h-4 w-4" />
            Retour aux comptes rendu
          </Link>
        }
      />

      <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <DataTable
          columns={columns}
          data={logs}
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
    </div>
  );
}
