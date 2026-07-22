"use client";

import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import type { ColumnDef } from "@tanstack/react-table";

import { PageHeader } from "@/components/ui/PageHeader";
import { DataTable } from "@/components/common/DataTable";
import { FormField } from "@/components/ui/FormField";
import { LimitedSelect as ReactSelect } from "@/components/ui/LimitedSelect";
import { hrApi, type TimeOff, type TimeoffStatus, type Employee } from "@/lib/api/hr";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDate(s?: string | null): string {
  if (!s) return "—";
  return new Date(s).toLocaleDateString("fr-FR");
}

function StatusBadge({ status }: { status: TimeoffStatus }) {
  const map: Record<TimeoffStatus, { label: string; cls: string }> = {
    APPROVED: { label: "Approuvé", cls: "bg-green-50 text-green-700 ring-green-600/20" },
    REJECTED: { label: "Rejeté", cls: "bg-red-50 text-red-700 ring-red-600/20" },
    PENDING: { label: "En attente", cls: "bg-yellow-50 text-yellow-700 ring-yellow-600/20" },
  };
  const { label, cls } = map[status];
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${cls}`}>
      {label}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Page — « Toutes les demandes » (réplique la modale Laravel employee_timeoffs/see :
// on sélectionne un employé, on voit ses demandes de congé).
// ---------------------------------------------------------------------------

export default function TimeoffAllRequestsPage() {
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>("");

  const { data: employeesData } = useQuery({
    queryKey: ["employees"],
    queryFn: () => hrApi.findAll({ size: 200 }).then((r) => r.data),
  });
  const employees: Employee[] = employeesData?.content ?? [];
  const employeeOptions = employees.map((e) => ({
    value: e.id,
    label: `${e.firstName} ${e.lastName}`,
  }));

  const { data: timeoffData, isLoading } = useQuery({
    queryKey: ["time-offs", selectedEmployeeId],
    queryFn: () =>
      hrApi.getTimeOffs(selectedEmployeeId, { size: 200 }).then((r) => r.data),
    enabled: !!selectedEmployeeId,
  });
  // Tri du plus récemment créé au plus ancien (fallback sur la date de début).
  const timeOffs: TimeOff[] = useMemo(
    () =>
      [...(timeoffData?.content ?? [])].sort(
        (a, b) =>
          new Date(b.createdAt ?? b.startDate).getTime() -
          new Date(a.createdAt ?? a.startDate).getTime()
      ),
    [timeoffData?.content],
  );

  const columns: ColumnDef<TimeOff>[] = [
    { header: "Date début", accessorKey: "startDate", cell: ({ row }) => formatDate(row.original.startDate) },
    { header: "Date fin", accessorKey: "endDate", cell: ({ row }) => formatDate(row.original.endDate) },
    { header: "Type", accessorKey: "reason", cell: ({ row }) => row.original.reason ?? "—" },
    { header: "Status", accessorKey: "status", cell: ({ row }) => <StatusBadge status={row.original.status} /> },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Toutes les demandes"
        breadcrumbs={[{ label: "Equipes" }, { label: "Toutes les demandes" }]}
      />

      <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <FormField label="Employé">
          <div className="max-w-md">
            <ReactSelect
              instanceId="timeoff-see-employee"
              options={employeeOptions}
              value={employeeOptions.find((o) => o.value === selectedEmployeeId) ?? null}
              onChange={(opt) => setSelectedEmployeeId(opt?.value ?? "")}
              placeholder="Sélectionner un employé..."
              isClearable
              classNamePrefix="react-select"
            />
          </div>
        </FormField>

        <div className="mt-5">
          {!selectedEmployeeId ? (
            <p className="py-6 text-center text-sm text-gray-500">
              Sélectionnez un employé pour voir ses demandes de congé.
            </p>
          ) : (
            <DataTable columns={columns} data={timeOffs} isLoading={isLoading} />
          )}
        </div>
      </div>
    </div>
  );
}
