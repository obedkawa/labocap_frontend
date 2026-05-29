"use client";

import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Check, X } from "lucide-react";
import type { ColumnDef } from "@tanstack/react-table";
import type { AxiosError } from "axios";
import type { UseFormReturn } from "react-hook-form";
import ReactSelect from "react-select";

import { PageHeader } from "@/components/ui/PageHeader";
import { DataTable } from "@/components/common/DataTable";
import { CrudModal } from "@/components/common/CrudModal";
import { PermissionGate } from "@/components/common/PermissionGate";
import { FormField } from "@/components/ui/FormField";
import { usePermissions } from "@/hooks/usePermissions";
import { PERMISSIONS } from "@/lib/constants/permissions";
import { hrApi, TimeOff, TimeOffRequest, TimeoffStatus, Employee } from "@/lib/api/hr";

// ---------------------------------------------------------------------------
// Zod schema — aligné sur EmployeeTimeoffRequestDto (startDate, endDate requis)
// ---------------------------------------------------------------------------

const timeOffSchema = z.object({
  employeeId: z.string().min(1, "L'employé est requis"),
  startDate: z.string().min(1, "La date de début est requise"),
  endDate: z.string().min(1, "La date de fin est requise"),
  reason: z.string().optional(),
});

type TimeOffFormValues = z.infer<typeof timeOffSchema>;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const inputClass =
  "w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:bg-gray-50 disabled:text-gray-500";

const selectClass =
  "w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white";

function diffDays(start: string, end: string): number {
  const s = new Date(start);
  const e = new Date(end);
  const diff = Math.round((e.getTime() - s.getTime()) / (1000 * 60 * 60 * 24));
  return diff >= 0 ? diff + 1 : 0;
}

// ---------------------------------------------------------------------------
// Status badge
// ---------------------------------------------------------------------------

function TimeOffStatusBadge({ status }: { status: TimeoffStatus }) {
  if (status === "APPROVED") {
    return (
      <span className="inline-flex items-center rounded-full bg-green-50 px-2.5 py-0.5 text-xs font-medium text-green-700 ring-1 ring-inset ring-green-600/20">
        Approuvé
      </span>
    );
  }
  if (status === "REJECTED") {
    return (
      <span className="inline-flex items-center rounded-full bg-red-50 px-2.5 py-0.5 text-xs font-medium text-red-700 ring-1 ring-inset ring-red-600/20">
        Rejeté
      </span>
    );
  }
  return (
    <span className="inline-flex items-center rounded-full bg-yellow-50 px-2.5 py-0.5 text-xs font-medium text-yellow-700 ring-1 ring-inset ring-yellow-600/20">
      En attente
    </span>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function TimeOffPage() {
  const { can } = usePermissions();
  const queryClient = useQueryClient();

  const [createOpen, setCreateOpen] = useState(false);

  // Filtre employé sélectionné (pour charger ses congés)
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>("");
  const [filterStatus, setFilterStatus] = useState<string>("");
  const [filterMonth, setFilterMonth] = useState<string>("");

  // ---- Queries & Mutations ------------------------------------------------

  const { data: employeesData } = useQuery({
    queryKey: ["employees"],
    queryFn: () => hrApi.findAll({ size: 200 }).then((r) => r.data),
  });

  const employees: Employee[] = employeesData?.content ?? [];

  const employeeOptions = employees.map((e) => ({
    value: e.id,
    label: `${e.firstName} ${e.lastName}`,
  }));

  // Charger les congés de l'employé sélectionné
  const { data: timeoffData, isLoading } = useQuery({
    queryKey: ["time-offs", selectedEmployeeId],
    queryFn: () =>
      hrApi.getTimeOffs(selectedEmployeeId, { size: 200 }).then((r) => r.data),
    enabled: !!selectedEmployeeId,
  });

  const timeOffs: TimeOff[] = timeoffData?.content ?? [];

  // Congés filtrés
  const filtered = useMemo(() => {
    return timeOffs.filter((t) => {
      const matchStatus = !filterStatus || t.status === filterStatus;
      const matchMonth =
        !filterMonth ||
        t.startDate.startsWith(filterMonth) ||
        t.endDate.startsWith(filterMonth);
      return matchStatus && matchMonth;
    });
  }, [timeOffs, filterStatus, filterMonth]);

  const createMutation = useMutation({
    mutationFn: ({ employeeId, payload }: { employeeId: string; payload: TimeOffRequest }) =>
      hrApi.createTimeOff(employeeId, payload),
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ["time-offs", vars.employeeId] });
      toast.success("Demande de congé créée");
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

  const approveMutation = useMutation({
    mutationFn: ({ employeeId, timeoffId }: { employeeId: string; timeoffId: string }) =>
      hrApi.updateTimeoffStatus(employeeId, timeoffId, { status: "APPROVED" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["time-offs", selectedEmployeeId] });
      toast.success("Congé approuvé");
    },
    onError: (err: AxiosError) => {
      const msg =
        (err.response?.data as { message?: string })?.message ??
        "Une erreur est survenue";
      toast.error(msg);
    },
  });

  const rejectMutation = useMutation({
    mutationFn: ({ employeeId, timeoffId }: { employeeId: string; timeoffId: string }) =>
      hrApi.updateTimeoffStatus(employeeId, timeoffId, { status: "REJECTED" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["time-offs", selectedEmployeeId] });
      toast.success("Congé rejeté");
    },
    onError: (err: AxiosError) => {
      const msg =
        (err.response?.data as { message?: string })?.message ??
        "Une erreur est survenue";
      toast.error(msg);
    },
  });

  // ---- Forms ---------------------------------------------------------------

  const createForm = useForm<TimeOffFormValues>({
    resolver: zodResolver(timeOffSchema),
    defaultValues: {
      employeeId: "",
      startDate: "",
      endDate: "",
      reason: "",
    },
  });

  // ---- Handlers ------------------------------------------------------------

  function onCreateSubmit(values: TimeOffFormValues) {
    createMutation.mutate({
      employeeId: values.employeeId,
      payload: {
        startDate: values.startDate,
        endDate: values.endDate,
        reason: values.reason || undefined,
      },
    });
  }

  // ---- Columns -------------------------------------------------------------

  const columns: ColumnDef<TimeOff>[] = [
    {
      header: "Date début",
      accessorKey: "startDate",
      cell: ({ row }) =>
        new Date(row.original.startDate).toLocaleDateString("fr-FR"),
    },
    {
      header: "Date fin",
      accessorKey: "endDate",
      cell: ({ row }) =>
        new Date(row.original.endDate).toLocaleDateString("fr-FR"),
    },
    {
      header: "Durée (j.)",
      id: "duration",
      cell: ({ row }) => {
        const days = diffDays(row.original.startDate, row.original.endDate);
        return `${days} j.`;
      },
    },
    {
      header: "Motif",
      accessorKey: "reason",
      cell: ({ row }) => row.original.reason ?? "—",
    },
    {
      header: "Statut",
      accessorKey: "status",
      cell: ({ row }) => <TimeOffStatusBadge status={row.original.status} />,
    },
    {
      header: "Actions",
      id: "actions",
      cell: ({ row }) => {
        const isPending = row.original.status === "PENDING";
        if (!isPending) return <span className="text-gray-400 text-xs">—</span>;
        return (
          <PermissionGate permission={PERMISSIONS.MANAGE_TIMEOFF}>
            <div className="flex items-center gap-2">
              <button
                onClick={() =>
                  approveMutation.mutate({
                    employeeId: row.original.employeeId,
                    timeoffId: row.original.id,
                  })
                }
                disabled={approveMutation.isPending}
                className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs font-medium bg-green-50 text-green-700 hover:bg-green-100 transition-colors disabled:opacity-50"
                aria-label="Approuver"
              >
                <Check className="h-3.5 w-3.5" />
                Approuver
              </button>
              <button
                onClick={() =>
                  rejectMutation.mutate({
                    employeeId: row.original.employeeId,
                    timeoffId: row.original.id,
                  })
                }
                disabled={rejectMutation.isPending}
                className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs font-medium bg-red-50 text-red-700 hover:bg-red-100 transition-colors disabled:opacity-50"
                aria-label="Rejeter"
              >
                <X className="h-3.5 w-3.5" />
                Rejeter
              </button>
            </div>
          </PermissionGate>
        );
      },
    },
  ];

  // ---- Render --------------------------------------------------------------

  return (
    <div className="space-y-6">
      <PageHeader
        title="Congés"
        action={
          can(PERMISSIONS.MANAGE_TIMEOFF) ? (
            <button
              onClick={() => {
                createForm.reset();
                setCreateOpen(true);
              }}
              className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
            >
              Nouvelle demande
            </button>
          ) : undefined
        }
      />

      {/* Filtres */}
      <div className="flex flex-wrap gap-3 rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
        <div className="min-w-[220px]">
          <ReactSelect
            options={employeeOptions}
            value={employeeOptions.find((o) => o.value === selectedEmployeeId) ?? null}
            onChange={(opt) => setSelectedEmployeeId(opt?.value ?? "")}
            placeholder="Sélectionner un employé..."
            isClearable
            classNamePrefix="react-select"
          />
        </div>

        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className={selectClass + " max-w-[180px]"}
        >
          <option value="">Tous les statuts</option>
          <option value="PENDING">En attente</option>
          <option value="APPROVED">Approuvé</option>
          <option value="REJECTED">Rejeté</option>
        </select>

        <input
          type="month"
          value={filterMonth}
          onChange={(e) => setFilterMonth(e.target.value)}
          className={inputClass + " max-w-[180px]"}
          title="Filtrer par mois"
        />
      </div>

      {!selectedEmployeeId && (
        <div className="rounded-xl border border-gray-200 bg-white p-6 text-center shadow-sm">
          <p className="text-sm text-gray-500">
            Sélectionnez un employé pour afficher ses congés.
          </p>
        </div>
      )}

      {selectedEmployeeId && (
        <div className="rounded-xl border border-gray-200 bg-white shadow-sm p-5">
          <DataTable columns={columns} data={filtered} isLoading={isLoading} />
        </div>
      )}

      {/* ---- Modal création ---- */}
      <CrudModal
        isOpen={createOpen}
        onClose={() => setCreateOpen(false)}
        title="Nouvelle demande de congé"
        size="lg"
        onSubmit={createForm.handleSubmit(onCreateSubmit)}
        submitLabel="Soumettre la demande"
        isSubmitting={createMutation.isPending}
      >
        <TimeOffForm form={createForm} employeeOptions={employeeOptions} />
      </CrudModal>
    </div>
  );
}

// ---------------------------------------------------------------------------
// TimeOffForm — formulaire création
// ---------------------------------------------------------------------------

interface EmployeeOption {
  value: string;
  label: string;
}

interface TimeOffFormProps {
  form: UseFormReturn<TimeOffFormValues>;
  employeeOptions: EmployeeOption[];
}

function TimeOffForm({ form, employeeOptions }: TimeOffFormProps) {
  const {
    register,
    control,
    formState: { errors },
  } = form;

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <FormField
        label="Employé"
        required
        error={errors.employeeId?.message}
        className="sm:col-span-2"
      >
        <Controller
          name="employeeId"
          control={control}
          render={({ field }) => (
            <ReactSelect
              options={employeeOptions}
              value={employeeOptions.find((o) => o.value === field.value) ?? null}
              onChange={(opt) => field.onChange(opt?.value ?? "")}
              placeholder="Sélectionner un employé..."
              isClearable
              classNamePrefix="react-select"
            />
          )}
        />
      </FormField>

      <FormField label="Date de début" required error={errors.startDate?.message}>
        <input
          type="date"
          {...register("startDate")}
          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:bg-gray-50 disabled:text-gray-500"
        />
      </FormField>

      <FormField label="Date de fin" required error={errors.endDate?.message}>
        <input
          type="date"
          {...register("endDate")}
          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:bg-gray-50 disabled:text-gray-500"
        />
      </FormField>

      <FormField label="Motif" error={errors.reason?.message} className="sm:col-span-2">
        <textarea
          {...register("reason")}
          rows={3}
          placeholder="Motif du congé (optionnel)..."
          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 resize-none"
        />
      </FormField>
    </div>
  );
}
