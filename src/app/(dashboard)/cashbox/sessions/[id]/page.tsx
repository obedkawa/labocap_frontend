"use client";

import { use, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import Link from "next/link";
import { ArrowLeft, Lock, FileDown } from "lucide-react";
import type { ColumnDef } from "@tanstack/react-table";
import type { AxiosError } from "axios";
import type { UseFormReturn } from "react-hook-form";

import { PageHeader } from "@/components/ui/PageHeader";
import { DataTable } from "@/components/common/DataTable";
import { CrudModal } from "@/components/common/CrudModal";
import { PermissionGate } from "@/components/common/PermissionGate";
import { FormField } from "@/components/ui/FormField";
import { PERMISSIONS } from "@/lib/constants/permissions";
import {
  cashboxApi,
  CashboxOperationResponseDto,
  CashboxDailyCloseDto,
} from "@/lib/api/cashbox";

// ---------------------------------------------------------------------------
// Schéma Zod — clôture
// ---------------------------------------------------------------------------

const closeSchema = z.object({
  closingBalance: z.string().min(1, "Requis"),
  cashCalculated: z.string().min(1, "Requis"),
  cashConfirmation: z.string().min(1, "Requis"),
  mobileMoneyCalculated: z.string().min(1, "Requis"),
  moneyMoneyConfirmation: z.string().min(1, "Requis"),
  chequeCalculated: z.string().min(1, "Requis"),
  chequeConfirmation: z.string().min(1, "Requis"),
  virementCalculated: z.string().min(1, "Requis"),
  virementConfirmation: z.string().min(1, "Requis"),
});

type CloseValues = z.infer<typeof closeSchema>;

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

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
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

interface PageProps {
  params: Promise<{ id: string }>;
}

export default function CashboxSessionDetailPage({ params }: PageProps) {
  const { id } = use(params);
  const queryClient = useQueryClient();
  const [closeOpen, setCloseOpen] = useState(false);

  // ---- Queries ----
  const { data: session, isLoading: sessionLoading } = useQuery({
    queryKey: ["cashbox-daily", id],
    queryFn: () => cashboxApi.getDaily(id).then((r) => r.data),
  });

  // Date de la session au format attendu par le backend (ISO LocalDate : YYYY-MM-DD).
  const sessionDate = session?.date ? session.date.slice(0, 10) : undefined;

  const { data: operationsData, isLoading: operationsLoading } = useQuery({
    queryKey: ["cashbox-operations", id, sessionDate],
    queryFn: () =>
      cashboxApi
        .getOperations({
          cashboxId: session?.cashboxId,
          date: sessionDate,
          page: 0,
          size: 100,
        })
        .then((r) => r.data),
    enabled: !!session?.cashboxId && !!sessionDate,
  });

  const operations: CashboxOperationResponseDto[] =
    operationsData?.content ?? [];

  // ---- Mutation clôture ----
  const closeMutation = useMutation({
    mutationFn: (data: CashboxDailyCloseDto) =>
      cashboxApi.closeDaily(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cashbox-daily", id] });
      queryClient.invalidateQueries({ queryKey: ["cashbox-dailies"] });
      toast.success("Session clôturée avec succès");
      setCloseOpen(false);
      closeForm.reset();
    },
    onError: (err: AxiosError) => {
      const msg =
        (err.response?.data as { message?: string })?.message ??
        "Une erreur est survenue";
      toast.error(msg);
    },
  });

  // ---- Form clôture ----
  const closeForm = useForm<CloseValues>({
    resolver: zodResolver(closeSchema),
    defaultValues: {
      closingBalance: String(session?.openingBalance ?? ""),
      cashCalculated: "",
      cashConfirmation: "",
      mobileMoneyCalculated: "",
      moneyMoneyConfirmation: "",
      chequeCalculated: "",
      chequeConfirmation: "",
      virementCalculated: "",
      virementConfirmation: "",
    },
  });

  function onCloseSubmit(values: CloseValues) {
    const cashCalculated = Number(values.cashCalculated);
    const cashConfirmation = Number(values.cashConfirmation);
    const mobileMoneyCalculated = Number(values.mobileMoneyCalculated);
    const moneyMoneyConfirmation = Number(values.moneyMoneyConfirmation);
    const chequeCalculated = Number(values.chequeCalculated);
    const chequeConfirmation = Number(values.chequeConfirmation);
    const virementCalculated = Number(values.virementCalculated);
    const virementConfirmation = Number(values.virementConfirmation);

    const totalCalculated =
      cashCalculated +
      mobileMoneyCalculated +
      chequeCalculated +
      virementCalculated;
    const totalConfirmation =
      cashConfirmation +
      moneyMoneyConfirmation +
      chequeConfirmation +
      virementConfirmation;

    closeMutation.mutate({
      closingBalance: Number(values.closingBalance),
      cashCalculated,
      cashConfirmation,
      cashEcart: cashCalculated - cashConfirmation,
      mobileMoneyCalculated,
      moneyMoneyConfirmation,
      mobileMoneyEcart: mobileMoneyCalculated - moneyMoneyConfirmation,
      chequeCalculated,
      chequeConfirmation,
      chequeEcart: chequeCalculated - chequeConfirmation,
      virementCalculated,
      virementConfirmation,
      virementEcart: virementCalculated - virementConfirmation,
      totalCalculated,
      totalConfirmation,
      totalEcart: totalCalculated - totalConfirmation,
    });
  }

  // ---- Colonnes opérations ----
  const operationColumns: ColumnDef<CashboxOperationResponseDto>[] = [
    {
      header: "Type",
      accessorKey: "type",
      cell: ({ row }) => (
        <span className="text-xs font-medium text-gray-700">
          {row.original.type}
        </span>
      ),
    },
    {
      header: "Montant",
      accessorKey: "amount",
      cell: ({ row }) => formatFCFA(row.original.amount),
    },
    {
      header: "Description",
      accessorKey: "description",
      cell: ({ row }) => row.original.description ?? "—",
    },
    {
      header: "Date opération",
      accessorKey: "operationDate",
      cell: ({ row }) => formatDate(row.original.operationDate),
    },
    {
      header: "Créé le",
      accessorKey: "createdAt",
      cell: ({ row }) => formatDateTime(row.original.createdAt),
    },
  ];

  // ---- Render ----
  return (
    <PermissionGate
      permission={PERMISSIONS.VIEW_CASHBOX}
      fallback={
        <div className="flex h-64 items-center justify-center text-sm text-gray-500">
          Accès non autorisé.
        </div>
      }
    >
      <div className="space-y-6">
        <PageHeader
          title="Détail de la session"
          breadcrumbs={[
            { label: "Trésorerie" },
            { label: "Caisse de vente", href: "/cashbox" },
            { label: "Sessions", href: "/cashbox/sessions" },
            { label: "Détail" },
          ]}
          action={
            <div className="flex items-center gap-3">
              {session?.status === 1 && (
                <PermissionGate permission={PERMISSIONS.EDIT_CASHBOX_DAILIES}>
                  <button
                    onClick={() => {
                      closeForm.reset({
                        closingBalance: String(session?.openingBalance ?? ""),
                        cashCalculated: "",
                        cashConfirmation: "",
                        mobileMoneyCalculated: "",
                        moneyMoneyConfirmation: "",
                        chequeCalculated: "",
                        chequeConfirmation: "",
                        virementCalculated: "",
                        virementConfirmation: "",
                      });
                      setCloseOpen(true);
                    }}
                    className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 transition-colors"
                  >
                    <Lock className="h-4 w-4" />
                    Clôturer la session
                  </button>
                </PermissionGate>
              )}
              {session && (
                <button
                  type="button"
                  onClick={async () => {
                    try {
                      const res = await cashboxApi.downloadDailyPdf(id);
                      const blob = new Blob([res.data as BlobPart], { type: "application/pdf" });
                      const url = URL.createObjectURL(blob);
                      window.open(url, "_blank");
                      setTimeout(() => URL.revokeObjectURL(url), 10000);
                    } catch {
                      toast.error("Erreur lors de la génération du PDF");
                    }
                  }}
                  className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  <FileDown className="h-4 w-4" />
                  Imprimer / PDF
                </button>
              )}
              <Link
                href="/cashbox/sessions"
                className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
              >
                <ArrowLeft className="h-4 w-4" />
                Retour
              </Link>
            </div>
          }
        />

        {/* Récapitulatif session */}
        <div className="rounded-xl border border-gray-200 bg-white shadow-sm p-5">
          <h2 className="mb-4 text-base font-semibold text-gray-800">
            Récapitulatif
          </h2>

          {sessionLoading ? (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="space-y-1">
                  <div className="h-3 w-20 animate-pulse rounded bg-gray-200" />
                  <div className="h-5 w-28 animate-pulse rounded bg-gray-200" />
                </div>
              ))}
            </div>
          ) : session ? (
            <div className="grid grid-cols-2 gap-5 sm:grid-cols-3 lg:grid-cols-4">
              <InfoItem label="Code" value={session.code} />
              <InfoItem label="Date" value={formatDate(session.date)} />
              <InfoItem
                label="Solde ouverture"
                value={formatFCFA(session.openingBalance)}
              />
              <InfoItem
                label="Solde fermeture"
                value={formatFCFA(session.closingBalance)}
              />
              <InfoItem
                label="Total calculé"
                value={formatFCFA(session.totalCalculated)}
              />
              <InfoItem
                label="Total compté"
                value={formatFCFA(session.totalConfirmation)}
              />
              <InfoItem
                label="Écart total"
                value={formatFCFA(session.totalEcart)}
              />
              <div>
                <p className="text-xs text-gray-500">Statut</p>
                <div className="mt-0.5">{statusBadge(session.status)}</div>
              </div>
            </div>
          ) : (
            <p className="text-sm text-gray-500">Session introuvable.</p>
          )}
        </div>

        {/* Tableau de synthèse par mode de paiement */}
        {session && (session.cashCalculated !== null || session.status === 0) && (
          <div className="rounded-xl border border-gray-200 bg-white shadow-sm p-5">
            <h2 className="mb-4 text-base font-semibold text-gray-800">
              Synthèse par mode de paiement
            </h2>
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="py-2 pr-6 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                      Mode
                    </th>
                    <th className="py-2 pr-6 text-right text-xs font-semibold uppercase tracking-wide text-gray-500">
                      Calculé
                    </th>
                    <th className="py-2 pr-6 text-right text-xs font-semibold uppercase tracking-wide text-gray-500">
                      Compté
                    </th>
                    <th className="py-2 text-right text-xs font-semibold uppercase tracking-wide text-gray-500">
                      Écart
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  <PaymentRow
                    label="Espèces"
                    calculated={session.cashCalculated}
                    confirmation={session.cashConfirmation}
                    ecart={session.cashEcart}
                  />
                  <PaymentRow
                    label="Mobile Money"
                    calculated={session.mobileMoneyCalculated}
                    confirmation={session.moneyMoneyConfirmation}
                    ecart={session.mobileMoneyEcart}
                  />
                  <PaymentRow
                    label="Chèque"
                    calculated={session.chequeCalculated}
                    confirmation={session.chequeConfirmation}
                    ecart={session.chequeEcart}
                  />
                  <PaymentRow
                    label="Virement"
                    calculated={session.virementCalculated}
                    confirmation={session.virementConfirmation}
                    ecart={session.virementEcart}
                  />
                  <tr className="border-t-2 border-gray-300 font-semibold">
                    <td className="py-2 pr-6 text-gray-800">Total</td>
                    <td className="py-2 pr-6 text-right text-gray-800">
                      {formatFCFA(session.totalCalculated)}
                    </td>
                    <td className="py-2 pr-6 text-right text-gray-800">
                      {formatFCFA(session.totalConfirmation)}
                    </td>
                    <td
                      className={`py-2 text-right font-semibold ${
                        (session.totalEcart ?? 0) !== 0
                          ? "text-red-600"
                          : "text-green-600"
                      }`}
                    >
                      {formatFCFA(session.totalEcart)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Section Opérations */}
        <PermissionGate permission={PERMISSIONS.VIEW_CASHBOX_ADDS}>
          <div className="rounded-xl border border-gray-200 bg-white shadow-sm p-5">
            <h2 className="mb-4 text-base font-semibold text-gray-800">
              Opérations
            </h2>
            <DataTable
              columns={operationColumns}
              data={operations}
              isLoading={operationsLoading}
            />
          </div>
        </PermissionGate>
      </div>

      {/* Modal clôture */}
      <CrudModal
        isOpen={closeOpen}
        onClose={() => setCloseOpen(false)}
        title="Clôturer la session de caisse"
        size="xl"
        onSubmit={closeForm.handleSubmit(onCloseSubmit)}
        submitLabel="Clôturer"
        isSubmitting={closeMutation.isPending}
      >
        <CloseDailyForm form={closeForm} />
      </CrudModal>
    </PermissionGate>
  );
}

// ---------------------------------------------------------------------------
// Composants utilitaires
// ---------------------------------------------------------------------------

function InfoItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-gray-500">{label}</p>
      <p className="mt-0.5 text-sm font-medium text-gray-800">{value}</p>
    </div>
  );
}

function PaymentRow({
  label,
  calculated,
  confirmation,
  ecart,
}: {
  label: string;
  calculated: number | null;
  confirmation: number | null;
  ecart: number | null;
}) {
  return (
    <tr>
      <td className="py-2 pr-6 text-gray-700">{label}</td>
      <td className="py-2 pr-6 text-right text-gray-700">
        {formatFCFA(calculated)}
      </td>
      <td className="py-2 pr-6 text-right text-gray-700">
        {formatFCFA(confirmation)}
      </td>
      <td
        className={`py-2 text-right text-sm font-medium ${
          (ecart ?? 0) !== 0 ? "text-red-600" : "text-green-600"
        }`}
      >
        {formatFCFA(ecart)}
      </td>
    </tr>
  );
}

// ---------------------------------------------------------------------------
// Formulaire de clôture
// ---------------------------------------------------------------------------

function CloseDailyForm({ form }: { form: UseFormReturn<CloseValues> }) {
  const {
    register,
    watch,
    formState: { errors },
  } = form;

  const inputClass =
    "w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500";

  // Calcul des écarts en temps réel
  const cashCalc = Number(watch("cashCalculated") || 0);
  const cashConf = Number(watch("cashConfirmation") || 0);
  const mmCalc = Number(watch("mobileMoneyCalculated") || 0);
  const mmConf = Number(watch("moneyMoneyConfirmation") || 0);
  const chequeCalc = Number(watch("chequeCalculated") || 0);
  const chequeConf = Number(watch("chequeConfirmation") || 0);
  const virCalc = Number(watch("virementCalculated") || 0);
  const virConf = Number(watch("virementConfirmation") || 0);

  const totalCalc = cashCalc + mmCalc + chequeCalc + virCalc;
  const totalConf = cashConf + mmConf + chequeConf + virConf;

  function ecartClass(calc: number, conf: number) {
    return calc - conf !== 0
      ? "font-medium text-red-600"
      : "font-medium text-green-600";
  }

  return (
    <div className="space-y-6">
      <p className="text-sm text-gray-500">
        Saisissez les montants calculés (selon le système) et comptés (vérification physique) pour chaque mode de paiement.
      </p>

      {/* Solde de clôture */}
      <FormField
        label="Solde de clôture (FCFA)"
        required
        error={errors.closingBalance?.message}
      >
        <input
          type="number"
          {...register("closingBalance")}
          min={0}
          placeholder="0"
          className={inputClass}
        />
      </FormField>

      {/* Tableau modes de paiement */}
      <div className="overflow-x-auto rounded-lg border border-gray-200">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="py-2.5 pl-4 pr-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                Mode
              </th>
              <th className="px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                Calculé (FCFA)
              </th>
              <th className="px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                Compté (FCFA)
              </th>
              <th className="py-2.5 pl-3 pr-4 text-right text-xs font-semibold uppercase tracking-wide text-gray-500">
                Écart
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 bg-white">
            {/* Espèces */}
            <tr>
              <td className="py-3 pl-4 pr-3 font-medium text-gray-700">
                Espèces
              </td>
              <td className="px-3 py-3">
                <input
                  type="number"
                  {...register("cashCalculated")}
                  min={0}
                  placeholder="0"
                  className={inputClass}
                />
                {errors.cashCalculated && (
                  <p className="mt-1 text-xs text-red-500">
                    {errors.cashCalculated.message}
                  </p>
                )}
              </td>
              <td className="px-3 py-3">
                <input
                  type="number"
                  {...register("cashConfirmation")}
                  min={0}
                  placeholder="0"
                  className={inputClass}
                />
                {errors.cashConfirmation && (
                  <p className="mt-1 text-xs text-red-500">
                    {errors.cashConfirmation.message}
                  </p>
                )}
              </td>
              <td
                className={`py-3 pl-3 pr-4 text-right ${ecartClass(cashCalc, cashConf)}`}
              >
                {formatFCFA(cashCalc - cashConf)}
              </td>
            </tr>

            {/* Mobile Money */}
            <tr>
              <td className="py-3 pl-4 pr-3 font-medium text-gray-700">
                Mobile Money
              </td>
              <td className="px-3 py-3">
                <input
                  type="number"
                  {...register("mobileMoneyCalculated")}
                  min={0}
                  placeholder="0"
                  className={inputClass}
                />
                {errors.mobileMoneyCalculated && (
                  <p className="mt-1 text-xs text-red-500">
                    {errors.mobileMoneyCalculated.message}
                  </p>
                )}
              </td>
              <td className="px-3 py-3">
                <input
                  type="number"
                  {...register("moneyMoneyConfirmation")}
                  min={0}
                  placeholder="0"
                  className={inputClass}
                />
                {errors.moneyMoneyConfirmation && (
                  <p className="mt-1 text-xs text-red-500">
                    {errors.moneyMoneyConfirmation.message}
                  </p>
                )}
              </td>
              <td
                className={`py-3 pl-3 pr-4 text-right ${ecartClass(mmCalc, mmConf)}`}
              >
                {formatFCFA(mmCalc - mmConf)}
              </td>
            </tr>

            {/* Chèque */}
            <tr>
              <td className="py-3 pl-4 pr-3 font-medium text-gray-700">
                Chèque
              </td>
              <td className="px-3 py-3">
                <input
                  type="number"
                  {...register("chequeCalculated")}
                  min={0}
                  placeholder="0"
                  className={inputClass}
                />
                {errors.chequeCalculated && (
                  <p className="mt-1 text-xs text-red-500">
                    {errors.chequeCalculated.message}
                  </p>
                )}
              </td>
              <td className="px-3 py-3">
                <input
                  type="number"
                  {...register("chequeConfirmation")}
                  min={0}
                  placeholder="0"
                  className={inputClass}
                />
                {errors.chequeConfirmation && (
                  <p className="mt-1 text-xs text-red-500">
                    {errors.chequeConfirmation.message}
                  </p>
                )}
              </td>
              <td
                className={`py-3 pl-3 pr-4 text-right ${ecartClass(chequeCalc, chequeConf)}`}
              >
                {formatFCFA(chequeCalc - chequeConf)}
              </td>
            </tr>

            {/* Virement */}
            <tr>
              <td className="py-3 pl-4 pr-3 font-medium text-gray-700">
                Virement
              </td>
              <td className="px-3 py-3">
                <input
                  type="number"
                  {...register("virementCalculated")}
                  min={0}
                  placeholder="0"
                  className={inputClass}
                />
                {errors.virementCalculated && (
                  <p className="mt-1 text-xs text-red-500">
                    {errors.virementCalculated.message}
                  </p>
                )}
              </td>
              <td className="px-3 py-3">
                <input
                  type="number"
                  {...register("virementConfirmation")}
                  min={0}
                  placeholder="0"
                  className={inputClass}
                />
                {errors.virementConfirmation && (
                  <p className="mt-1 text-xs text-red-500">
                    {errors.virementConfirmation.message}
                  </p>
                )}
              </td>
              <td
                className={`py-3 pl-3 pr-4 text-right ${ecartClass(virCalc, virConf)}`}
              >
                {formatFCFA(virCalc - virConf)}
              </td>
            </tr>

            {/* Total */}
            <tr className="border-t-2 border-gray-300 bg-gray-50">
              <td className="py-3 pl-4 pr-3 font-semibold text-gray-800">
                Total général
              </td>
              <td className="px-3 py-3 font-semibold text-gray-800">
                {formatFCFA(totalCalc)}
              </td>
              <td className="px-3 py-3 font-semibold text-gray-800">
                {formatFCFA(totalConf)}
              </td>
              <td
                className={`py-3 pl-3 pr-4 text-right font-bold ${
                  totalCalc - totalConf !== 0
                    ? "text-red-600"
                    : "text-green-600"
                }`}
              >
                {formatFCFA(totalCalc - totalConf)}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
