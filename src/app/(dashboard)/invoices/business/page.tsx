"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Search } from "lucide-react";
import { toast } from "sonner";

import { PageHeader } from "@/components/ui/PageHeader";
import { NativeSelect } from "@/components/ui/NativeSelect";
import { usePermissions } from "@/hooks/usePermissions";
import { PERMISSIONS } from "@/lib/constants/permissions";
import {
  invoicesApi,
  type InvoiceSearchResult,
} from "@/lib/api/invoices";

function formatFCFA(amount?: number): string {
  if (amount == null) return "0 FCFA";
  return new Intl.NumberFormat("fr-FR").format(amount) + " FCFA";
}

export default function InvoiceBusinessPage() {
  const { can } = usePermissions();
  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState(currentYear);

  // === Tableau mensuel
  const { data: monthlyStats, isLoading } = useQuery({
    queryKey: ["invoice-monthly-stats", selectedYear],
    queryFn: () =>
      invoicesApi.getMonthlyStats(selectedYear).then((r) => r.data),
  });

  // === Recherche par date
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [searchResult, setSearchResult] = useState<InvoiceSearchResult | null>(
    null,
  );
  const [searchLoading, setSearchLoading] = useState(false);

  const handleSearch = async () => {
    if (!startDate || !endDate) {
      toast.error("Veuillez saisir les deux dates");
      return;
    }
    setSearchLoading(true);
    try {
      const res = await invoicesApi.search({ startDate, endDate });
      setSearchResult(res.data);
    } catch {
      toast.error("Erreur lors de la recherche");
    } finally {
      setSearchLoading(false);
    }
  };

  if (!can(PERMISSIONS.VIEW_INVOICES)) {
    return (
      <div className="flex h-64 items-center justify-center">
        <p className="text-gray-500">Accès non autorisé</p>
      </div>
    );
  }

  const years = Array.from({ length: 6 }, (_, i) => currentYear - i);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Rapports — Factures"
        breadcrumbs={[
          { label: "Accueil", href: "/home" },
          { label: "Factures", href: "/invoices" },
          { label: "Rapports" },
        ]}
        action={
          <Link
            href="/invoices"
            className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            <ArrowLeft className="h-4 w-4" />
            Retour à la liste des factures
          </Link>
        }
      />

      {/* === Section 1 : Tableau mensuel === */}
      <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-base font-semibold text-gray-800">
            Synthèse mensuelle
          </h2>
          <NativeSelect
            value={selectedYear}
            onChange={(e) => setSelectedYear(Number(e.target.value))}
          >
            {years.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </NativeSelect>
        </div>

        <div className="overflow-hidden rounded-lg border border-gray-200">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-600">
                  Mois
                </th>
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-gray-600">
                  Facturés
                </th>
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-gray-600">
                  Avoirs
                </th>
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-gray-600">
                  Chiffre d&apos;affaires
                </th>
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-gray-600">
                  Encaissements
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {isLoading ? (
                <tr>
                  <td
                    colSpan={5}
                    className="px-4 py-8 text-center text-sm text-gray-500"
                  >
                    Chargement...
                  </td>
                </tr>
              ) : monthlyStats?.length === 0 ? (
                <tr>
                  <td
                    colSpan={5}
                    className="px-4 py-8 text-center text-sm text-gray-500"
                  >
                    Aucune donnée
                  </td>
                </tr>
              ) : (
                monthlyStats?.map((stats) => (
                  <tr key={stats.month} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-gray-900">
                      {stats.monthName}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-700">
                      {formatFCFA(stats.facturated)}
                    </td>
                    <td className="px-4 py-3 text-right text-red-600">
                      {formatFCFA(stats.credits)}
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-green-700">
                      {formatFCFA(stats.turnover)}
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-blue-700">
                      {formatFCFA(stats.collections)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* === Section 2 : Recherche par date === */}
      <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <h2 className="mb-4 text-base font-semibold text-gray-800">
          Recherche par date
        </h2>

        <div className="mb-4 flex flex-wrap items-end gap-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">
              Date Début
            </label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">
              Date Fin
            </label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
          <button
            type="button"
            onClick={handleSearch}
            disabled={searchLoading}
            className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            <Search className="h-4 w-4" />
            {searchLoading ? "Chargement..." : "Afficher"}
          </button>
        </div>

        {/* 4 KPI cards (visible après recherche) */}
        {searchResult && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-lg border border-red-200 bg-red-50 p-4">
              <p className="text-xs font-medium uppercase tracking-wider text-red-700">
                Factures
              </p>
              <p className="mt-1 text-2xl font-bold text-red-900">
                {formatFCFA(searchResult.facture)}
              </p>
            </div>
            <div className="rounded-lg border border-green-200 bg-green-50 p-4">
              <p className="text-xs font-medium uppercase tracking-wider text-green-700">
                Chiffres d&apos;affaires
              </p>
              <p className="mt-1 text-2xl font-bold text-green-900">
                {formatFCFA(searchResult.ca)}
              </p>
            </div>
            <div className="rounded-lg border border-red-200 bg-red-50 p-4">
              <p className="text-xs font-medium uppercase tracking-wider text-red-700">
                Avoir
              </p>
              <p className="mt-1 text-2xl font-bold text-red-900">
                {formatFCFA(searchResult.avoir)}
              </p>
            </div>
            <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
              <p className="text-xs font-medium uppercase tracking-wider text-blue-700">
                Encaissement
              </p>
              <p className="mt-1 text-2xl font-bold text-blue-900">
                {formatFCFA(searchResult.encaissement)}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
