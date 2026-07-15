"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { Eye, Plus } from "lucide-react";
import { toast } from "sonner";
import type { ColumnDef } from "@tanstack/react-table";
import type { AxiosError } from "axios";

import { PageHeader } from "@/components/ui/PageHeader";
import { DataTable } from "@/components/common/DataTable";
import { CrudModal } from "@/components/common/CrudModal";
import { PermissionGate } from "@/components/common/PermissionGate";
import { FormField } from "@/components/ui/FormField";
import { NativeSelect } from "@/components/ui/NativeSelect";
import { usePermissions } from "@/hooks/usePermissions";
import { PERMISSIONS } from "@/lib/constants/permissions";
import {
  cashboxApi,
  CashboxDailyResponseDto,
  CashboxResponseDto,
} from "@/lib/api/cashbox";
import type { ApiError } from "@/types/api";

const inputClass =
  "w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500";

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
  // Convention backend (CashboxDailyServiceImpl) : 1 = Ouverte, 0 = Clôturée.
  if (status === 1) {
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
  const { can } = usePermissions();
  const queryClient = useQueryClient();

  const [pageIndex, setPageIndex] = useState(0);
  const [pageSize, setPageSize] = useState(10);
  const [dateFilter, setDateFilter] = useState("");

  // ---- Ouverture de session
  const [openModalOpen, setOpenModalOpen] = useState(false);
  const [openingBalance, setOpeningBalance] = useState("");
  const [cashboxId, setCashboxId] = useState("");

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

  // Caisses disponibles (pour choisir laquelle ouvrir)
  const { data: cashboxes } = useQuery<CashboxResponseDto[]>({
    queryKey: ["cashboxes"],
    queryFn: () => cashboxApi.getCashboxes().then((r) => r.data.content),
    enabled: openModalOpen,
  });

  const openMutation = useMutation({
    mutationFn: () =>
      cashboxApi.openDaily({
        soldeOuverture: Number(openingBalance) || 0,
        cashboxId,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cashbox-dailies"] });
      queryClient.invalidateQueries({ queryKey: ["cashboxes"] });
      toast.success("Session ouverte");
      setOpenModalOpen(false);
      setOpeningBalance("");
      setCashboxId("");
    },
    onError: (e: AxiosError<ApiError>) =>
      toast.error(e.response?.data?.message ?? "Erreur lors de l'ouverture"),
  });

  const handleOpenSubmit = () => {
    if (!cashboxId) {
      toast.error("Veuillez sélectionner une caisse");
      return;
    }
    openMutation.mutate();
  };

  // ---- Colonnes — alignées sur la vue Laravel « Ouverture et fermeture » :
  // ID, Code, Date d'ouverture, Solde d'ouverture, Date de fermeture,
  // Solde de fermeture, Utilisateur, Écart, Statut, Actions.
  const columns: ColumnDef<CashboxDailyResponseDto>[] = [
    {
      header: "ID",
      id: "rownum",
      cell: ({ row }) => (
        <span className="text-xs text-gray-500">{row.index + 1}</span>
      ),
    },
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
      header: "Date d'ouverture",
      accessorKey: "createdAt",
      cell: ({ row }) => formatDate(row.original.createdAt),
    },
    {
      header: "Solde d'ouverture",
      accessorKey: "openingBalance",
      cell: ({ row }) => formatFCFA(row.original.openingBalance),
    },
    {
      header: "Date de fermeture",
      id: "closedAt",
      cell: ({ row }) =>
        row.original.status === 1 || !row.original.updatedAt ? (
          <span className="text-xs text-gray-400">Non disponible</span>
        ) : (
          formatDate(row.original.updatedAt)
        ),
    },
    {
      header: "Solde de fermeture",
      accessorKey: "closingBalance",
      cell: ({ row }) => formatFCFA(row.original.closingBalance),
    },
    {
      header: "Utilisateur",
      accessorKey: "userName",
      cell: ({ row }) => (
        <span className="text-sm text-gray-700">
          {row.original.userName ?? "—"}
        </span>
      ),
    },
    {
      header: "Écart",
      accessorKey: "totalEcart",
      cell: ({ row }) => {
        const ecart = row.original.totalEcart;
        if (ecart === null || ecart === undefined)
          return <span className="text-gray-400">—</span>;
        return (
          <span
            className={
              ecart < 0 ? "font-medium text-red-600" : "text-gray-700"
            }
          >
            {formatFCFA(ecart)}
          </span>
        );
      },
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
          title="Ouverture et fermeture (Caisse de vente)"
          subtitle="Historique des ouvertures et fermetures de caisse"
          breadcrumbs={[
            { label: "Trésorerie" },
            { label: "Caisse de vente", href: "/cashbox" },
            { label: "Ouverture et fermeture" },
          ]}
          action={
            can(PERMISSIONS.CREATE_CASHBOX_DAILIES) ? (
              <button
                type="button"
                onClick={() => setOpenModalOpen(true)}
                className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
              >
                <Plus className="h-4 w-4" />
                Ouvrir une session
              </button>
            ) : undefined
          }
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

        {/* Modal ouverture de session */}
        <CrudModal
          isOpen={openModalOpen}
          onClose={() => setOpenModalOpen(false)}
          title="Ouvrir une session de caisse"
          onSubmit={handleOpenSubmit}
          submitLabel="Ouvrir"
          isSubmitting={openMutation.isPending}
        >
          <div className="flex flex-col gap-4">
            <FormField label="Caisse" required>
              <NativeSelect
                value={cashboxId}
                onChange={(e) => setCashboxId(e.target.value)}
              >
                <option value="">Sélectionner une caisse…</option>
                {(cashboxes ?? []).map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name?.trim() ||
                      (c.type === "vente"
                        ? "Caisse de vente"
                        : c.type === "depense"
                          ? "Caisse de dépense"
                          : "Caisse")}
                  </option>
                ))}
              </NativeSelect>
            </FormField>

            <FormField label="Solde d'ouverture">
              <input
                type="number"
                min={0}
                value={openingBalance}
                onChange={(e) => setOpeningBalance(e.target.value)}
                placeholder="0"
                className={inputClass}
              />
            </FormField>
          </div>
        </CrudModal>
      </div>
    </PermissionGate>
  );
}
