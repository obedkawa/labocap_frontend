"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Search, Banknote, Lock, Unlock, LockOpen } from "lucide-react";
import type { ColumnDef } from "@tanstack/react-table";

import { PageHeader } from "@/components/ui/PageHeader";
import { DataTable } from "@/components/common/DataTable";
import { usePermissions } from "@/hooks/usePermissions";
import { PERMISSIONS } from "@/lib/constants/permissions";
import {
  cashboxApi,
  type CashboxResponseDto,
  type CashboxOperationResponseDto,
} from "@/lib/api/cashbox";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatFCFA(amount: number): string {
  return new Intl.NumberFormat("fr-FR").format(amount) + " FCFA";
}

function formatDateTime(value: string): string {
  if (!value) return "—";
  const d = new Date(value);
  return d.toLocaleDateString("fr-FR") + " " + d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
}

// ---------------------------------------------------------------------------
// Page principale — Caisse de vente (réplique Laravel cashbox.vente.index)
// ---------------------------------------------------------------------------

export default function CashboxVentePage() {
  const { can } = usePermissions();
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(20);

  // === Récupérer la caisse de vente
  const { data: cashboxesData } = useQuery({
    queryKey: ["cashboxes"],
    queryFn: () => cashboxApi.getCashboxes().then((r) => r.data.content),
  });

  // Sélectionne la première caisse de type "vente"
  const venteCashbox: CashboxResponseDto | undefined = (cashboxesData ?? []).find(
    (c) => c.type === "vente",
  );

  // === Opérations de la caisse de vente
  const { data: operationsData, isLoading } = useQuery({
    queryKey: ["cashbox-operations", { cashboxId: venteCashbox?.id, page, pageSize }],
    queryFn: () =>
      cashboxApi
        .getOperations({
          cashboxId: venteCashbox!.id,
          page,
          size: pageSize,
        })
        .then((r) => r.data),
    enabled: !!venteCashbox?.id,
  });

  const allOperations = operationsData?.content ?? [];

  // Filtrage local
  const operations = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return allOperations;
    return allOperations.filter(
      (o) =>
        (o.description ?? "").toLowerCase().includes(q) ||
        String(o.amount).includes(q),
    );
  }, [allOperations, search]);

  const totalElements = operationsData?.totalElements ?? 0;
  const totalPages = operationsData?.totalPages ?? 0;

  // === Status caisse (sessionnée ou non — basé sur statut)
  const isOpen = venteCashbox?.balance != null; // toujours active si elle existe

  // ---- Columns
  const columns: ColumnDef<CashboxOperationResponseDto>[] = [
    {
      header: "#",
      id: "rownum",
      cell: ({ row }) => (
        <span className="text-xs text-gray-500">
          {page * pageSize + row.index + 1}
        </span>
      ),
    },
    {
      header: "Montant",
      accessorKey: "amount",
      enableSorting: true,
      cell: ({ row }) => (
        <span className="font-medium text-gray-900">
          {formatFCFA(row.original.amount)}
        </span>
      ),
    },
    {
      header: "Type",
      accessorKey: "type",
      enableSorting: true,
      cell: ({ row }) => (
        <span
          className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
            row.original.type === "CREDIT"
              ? "bg-green-100 text-green-700"
              : "bg-red-100 text-red-700"
          }`}
        >
          {row.original.type === "CREDIT" ? "Crédit" : "Débit"}
        </span>
      ),
    },
    {
      header: "Description",
      accessorKey: "description",
      enableSorting: true,
      cell: ({ row }) => (
        <span className="text-sm text-gray-700">
          {row.original.description ?? "—"}
        </span>
      ),
    },
    {
      header: "Date opération",
      accessorKey: "operationDate",
      enableSorting: true,
      cell: ({ row }) =>
        row.original.operationDate
          ? new Date(row.original.operationDate).toLocaleDateString("fr-FR")
          : "—",
    },
    {
      header: "Date enreg.",
      accessorKey: "createdAt",
      enableSorting: true,
      cell: ({ row }) => formatDateTime(row.original.createdAt),
    },
  ];

  if (!can(PERMISSIONS.VIEW_CASHBOXES)) {
    return (
      <div className="flex h-64 items-center justify-center">
        <p className="text-gray-500">Accès non autorisé</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Caisse de vente"
        breadcrumbs={[
          { label: "Accueil", href: "/home" },
          { label: "Trésorerie" },
          { label: "Caisse de vente" },
        ]}
        action={
          <div className="flex flex-wrap items-center gap-2">
            {/* Statut */}
            {venteCashbox && (
              <span
                className={`inline-flex items-center gap-1 rounded-md px-3 py-1.5 text-xs font-medium ${
                  isOpen
                    ? "bg-green-100 text-green-700"
                    : "bg-red-100 text-red-700"
                }`}
              >
                {isOpen ? <Unlock className="h-3.5 w-3.5" /> : <Lock className="h-3.5 w-3.5" />}
                {isOpen ? "Ouvert" : "Fermée"}
              </span>
            )}
            {/* Dépôt bancaire */}
            <button
              type="button"
              className="inline-flex items-center gap-2 rounded-md bg-gray-600 px-4 py-2 text-sm font-medium text-white hover:bg-gray-700"
              title="Enregistrer un dépôt bancaire"
              disabled
            >
              <Banknote className="h-4 w-4" />
              Enregistrer un dépôt bancaire
            </button>
            {/* Ouverture/Fermeture */}
            <Link
              href="/cashbox/sessions"
              className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
            >
              <LockOpen className="h-4 w-4" />
              Ouverture / Fermeture
            </Link>
          </div>
        }
      />

      {/* === KPI Solde actuel === */}
      {venteCashbox && (
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-wider text-gray-500">Solde actuel</p>
              <p className="mt-1 text-3xl font-bold text-green-700">
                {formatFCFA(venteCashbox.balance)}
              </p>
            </div>
            <Link
              href="/cashbox/sessions"
              className="text-sm text-blue-600 hover:underline"
            >
              Voir toutes les sessions →
            </Link>
          </div>
        </div>
      )}

      {/* === Tableau historique des opérations === */}
      <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-base font-semibold text-gray-800">
            Historique des opérations
          </h2>

          <div className="flex items-center gap-3">
            <div className="relative w-full max-w-xs">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Rechercher..."
                className="w-full rounded-md border border-gray-300 pl-9 pr-3 py-2 text-sm shadow-sm placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
            <span className="text-sm text-gray-500 whitespace-nowrap">
              {totalElements} opération{totalElements > 1 ? "s" : ""}
            </span>
          </div>
        </div>

        <DataTable
          columns={columns}
          data={operations}
          isLoading={isLoading}
          pageCount={totalPages}
          pageIndex={page}
          pageSize={pageSize}
          onPageChange={setPage}
          onPageSizeChange={(size) => { setPageSize(size); setPage(0); }}
        />
      </div>
    </div>
  );
}
