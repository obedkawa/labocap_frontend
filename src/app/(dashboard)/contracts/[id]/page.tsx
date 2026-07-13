"use client";

import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Pencil, Trash2 } from "lucide-react";
import Link from "next/link";
import type { AxiosError } from "axios";

import { PageHeader } from "@/components/ui/PageHeader";
import { NativeSelect } from "@/components/ui/NativeSelect";
import { CrudModal } from "@/components/common/CrudModal";
import { ConfirmModal } from "@/components/common/ConfirmModal";
import { PermissionGate } from "@/components/common/PermissionGate";
import { FormField } from "@/components/ui/FormField";
import { PERMISSIONS } from "@/lib/constants/permissions";
import { contractsApi, type ContractDetail } from "@/lib/api/contracts";
import { labTestsApi } from "@/lib/api/examens";
import type { ApiError } from "@/types/api";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDate(s?: string | null) {
  if (!s) return "—";
  return new Date(s).toLocaleDateString("fr-FR");
}

function formatAmount(v?: number | null) {
  if (v == null) return "—";
  return new Intl.NumberFormat("fr-FR").format(v) + " FCFA";
}

const inputClass =
  "w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 read-only:bg-gray-50 read-only:text-gray-500";

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function ContractDetailPage({
  params: paramsPromise,
}: {
  params: Promise<{ id: string }>;
}) {
  const params = use(paramsPromise);
  const contractId = params.id;

  const router = useRouter();
  const queryClient = useQueryClient();

  // Formulaire « Ajouter des examens » (inline, comme dans la vue Laravel)
  const [testId, setTestId] = useState("");
  const [price, setPrice] = useState(0);
  const [remise, setRemise] = useState("");

  const [deleteDetail, setDeleteDetail] = useState<ContractDetail | null>(null);
  const [editDetail, setEditDetail] = useState<ContractDetail | null>(null);
  const [editRemise, setEditRemise] = useState("");

  // ---- Queries -------------------------------------------------------------

  const { data: contract, isLoading } = useQuery({
    queryKey: ["contract", contractId],
    queryFn: () => contractsApi.findById(contractId).then((r) => r.data),
  });

  const { data: examensData } = useQuery({
    queryKey: ["examens-all"],
    queryFn: () => labTestsApi.findAll({ size: 200 }).then((r) => r.data),
  });

  const examens = examensData?.content ?? [];

  // Auto-remplissage du prix quand un examen est sélectionné
  useEffect(() => {
    const found = examens.find((e) => e.id === testId);
    setPrice(found?.price ?? 0);
  }, [testId, examens]);

  const remiseNum = Number(remise) || 0;
  const total = price - remiseNum;

  const editRemiseNum = Number(editRemise) || 0;
  const editTotal = (editDetail?.price ?? 0) - editRemiseNum;

  // ---- Mutations -----------------------------------------------------------

  const addTestMutation = useMutation({
    mutationFn: () =>
      contractsApi.addTestDetail(contractId, {
        testId,
        amountRemise: remiseNum,
        amountAfterRemise: total,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["contract", contractId] });
      toast.success("Donnée ajoutée avec succès");
      setTestId("");
      setPrice(0);
      setRemise("");
    },
    onError: (e: AxiosError<ApiError>) =>
      toast.error(e.response?.data?.message ?? "Erreur"),
  });

  const updateDetailMutation = useMutation({
    mutationFn: () =>
      contractsApi.updateTestDetail(contractId, editDetail!.id, {
        amountRemise: editRemiseNum,
        amountAfterRemise: editTotal,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["contract", contractId] });
      toast.success("Ligne mise à jour");
      setEditDetail(null);
    },
    onError: (e: AxiosError<ApiError>) =>
      toast.error(e.response?.data?.message ?? "Erreur"),
  });

  const deleteDetailMutation = useMutation({
    mutationFn: (detailId: string) =>
      contractsApi.deleteDetail(contractId, detailId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["contract", contractId] });
      toast.success("Ligne supprimée");
      setDeleteDetail(null);
    },
    onError: (e: AxiosError<ApiError>) =>
      toast.error(e.response?.data?.message ?? "Erreur"),
  });

  const activateMutation = useMutation({
    mutationFn: () => contractsApi.activate(contractId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["contract", contractId] });
      toast.success("Contrat activé");
    },
    onError: (e: AxiosError<ApiError>) =>
      toast.error(e.response?.data?.message ?? "Erreur"),
  });

  const closeMutation = useMutation({
    mutationFn: () => contractsApi.close(contractId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["contract", contractId] });
      toast.success("Contrat clôturé");
    },
    onError: (e: AxiosError<ApiError>) =>
      toast.error(e.response?.data?.message ?? "Erreur"),
  });

  // « Sauvegarder » = mise à jour du statut à ACTIF puis retour à la liste
  // (équivalent Laravel contrat_details.update-status).
  const saveMutation = useMutation({
    mutationFn: () => contractsApi.activate(contractId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["contract", contractId] });
      toast.success("Statut mis à jour !");
      router.push("/contracts");
    },
    onError: (e: AxiosError<ApiError>) =>
      toast.error(e.response?.data?.message ?? "Erreur"),
  });

  // ---- Render --------------------------------------------------------------

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
      </div>
    );
  }

  if (!contract) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-gray-500">Contrat introuvable</p>
      </div>
    );
  }

  const details = contract.details ?? [];
  const isClose = contract.isClose === true;
  const used = contract.usedTestsCount ?? 0;
  const invoice = contract.invoice ?? null;
  const showInvoiceCard = contract.invoiceUnique === true && invoice != null;

  return (
    <div className="space-y-6">
      <PageHeader
        title=""
        action={
          <Link
            href="/contracts"
            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
          >
            Retour à la liste des contrats
          </Link>
        }
      />

      {/* ============ Cartes Contrat / Facture ============ */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        {/* --- Carte Contrat --- */}
        <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
          <div className="flex items-center justify-between gap-3 border-b border-gray-100 px-5 py-4">
            <h2 className="text-base font-semibold text-gray-900">
              Contrat : {contract.name ?? "—"}
            </h2>
            <PermissionGate permission={PERMISSIONS.EDIT_CONTRACTS}>
              {contract.status === "ACTIF" && !isClose && (
                <button
                  type="button"
                  onClick={() => closeMutation.mutate()}
                  disabled={closeMutation.isPending}
                  className="inline-flex items-center rounded-lg bg-red-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-700 transition-colors disabled:opacity-50"
                >
                  Clôturer
                </button>
              )}
              {contract.status === "INACTIF" && !isClose && (
                <button
                  type="button"
                  onClick={() => activateMutation.mutate()}
                  disabled={activateMutation.isPending}
                  className="inline-flex items-center rounded-lg bg-green-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-green-700 transition-colors disabled:opacity-50"
                >
                  Activer
                </button>
              )}
            </PermissionGate>
          </div>

          <div className="space-y-2 px-5 py-4 text-sm text-gray-700">
            <p>
              <strong className="font-semibold text-gray-900">Date : </strong>
              {formatDate(contract.createdAt)}
            </p>
            <p>
              <strong className="font-semibold text-gray-900">Type : </strong>
              {contract.type ?? "—"}
            </p>
            <p>
              <strong className="font-semibold text-gray-900">Status : </strong>
              {isClose
                ? `CLÔTURER, le ${formatDate(contract.updatedAt)}`
                : contract.status}
            </p>
            <p>
              <strong className="font-semibold text-gray-900">
                Nombre d&apos;examens :{" "}
              </strong>
              {contract.nbrTests === -1
                ? `${used}/Illimité`
                : `${used}/${contract.nbrTests}`}
            </p>
            <p>
              <strong className="font-semibold text-gray-900">
                Description :{" "}
              </strong>
              {contract.description ?? "—"}
            </p>
          </div>
        </div>

        {/* --- Carte Facture (uniquement facturation unique + facture existante) --- */}
        {showInvoiceCard && (
          <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
            <div className="flex items-center justify-between gap-3 border-b border-gray-100 px-5 py-4">
              <h2 className="text-base font-semibold text-gray-900">Facture</h2>
              <Link
                href={`/invoices/${invoice!.id}`}
                className="inline-flex items-center rounded-lg bg-green-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-green-700 transition-colors"
              >
                Voir plus
              </Link>
            </div>

            <div className="space-y-2 px-5 py-4 text-sm text-gray-700">
              {invoice!.code && (
                <p>
                  <strong className="font-semibold text-gray-900">Code : </strong>
                  {invoice!.code}
                </p>
              )}
              <p>
                <strong className="font-semibold text-gray-900">Client : </strong>
                {contract.clientName ?? "—"}
              </p>
              <p>
                <strong className="font-semibold text-gray-900">Status : </strong>
                {invoice!.isPaid
                  ? `Payé, le ${formatDate(invoice!.paidAt)}`
                  : "Non payé"}
              </p>
              <p>
                <strong className="font-semibold text-gray-900">Total : </strong>
                {formatAmount(invoice!.total)}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* ============ Ajouter des examens (formulaire inline) ============ */}
      {!isClose && (
        <PermissionGate permission={PERMISSIONS.EDIT_CONTRACTS}>
          <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <h2 className="mb-4 text-base font-semibold text-gray-900">
              Ajouter des examens
            </h2>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!testId) {
                  toast.error("Veuillez sélectionner un examen");
                  return;
                }
                addTestMutation.mutate();
              }}
              autoComplete="off"
              className="grid grid-cols-1 items-end gap-4 md:grid-cols-12"
            >
              <div className="md:col-span-4">
                <label className="mb-1.5 block text-sm font-medium text-gray-700">
                  Examen
                </label>
                <NativeSelect
                  value={testId}
                  onChange={(e) => setTestId(e.target.value)}
                  required
                >
                  <option value="">Sélectionner l&apos;examen</option>
                  {examens.map((ex) => (
                    <option key={ex.id} value={ex.id}>
                      {ex.name}
                    </option>
                  ))}
                </NativeSelect>
              </div>

              <div className="md:col-span-2">
                <label className="mb-1.5 block text-sm font-medium text-gray-700">
                  Prix
                </label>
                <input
                  type="text"
                  value={price}
                  readOnly
                  className={inputClass}
                />
              </div>

              <div className="md:col-span-2">
                <label className="mb-1.5 block text-sm font-medium text-gray-700">
                  Remise
                </label>
                <input
                  type="number"
                  value={remise}
                  onChange={(e) => setRemise(e.target.value)}
                  min={0}
                  required
                  className={inputClass}
                />
              </div>

              <div className="md:col-span-2">
                <label className="mb-1.5 block text-sm font-medium text-gray-700">
                  Total
                </label>
                <input
                  type="text"
                  value={total}
                  readOnly
                  className={inputClass}
                />
              </div>

              <div className="md:col-span-2">
                <button
                  type="submit"
                  disabled={addTestMutation.isPending}
                  className="inline-flex w-full items-center justify-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors disabled:opacity-50"
                >
                  Ajouter
                </button>
              </div>
            </form>
          </div>
        </PermissionGate>
      )}

      {/* ============ Examens prises en compte ============ */}
      <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="px-5 py-4 border-b border-gray-100">
          <h2 className="text-base font-semibold text-gray-900">
            Examens prises en compte
          </h2>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-gray-600">
                  Nom examen
                </th>
                <th className="text-right px-4 py-3 font-medium text-gray-600">
                  Prix
                </th>
                <th className="text-right px-4 py-3 font-medium text-gray-600">
                  Réduction
                </th>
                <th className="text-right px-4 py-3 font-medium text-gray-600">
                  Total
                </th>
                <th className="px-4 py-3 text-right font-medium text-gray-600">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {details.length === 0 ? (
                <tr>
                  <td
                    colSpan={5}
                    className="px-4 py-8 text-center text-sm text-gray-400"
                  >
                    Aucun examen pris en compte
                  </td>
                </tr>
              ) : (
                details.map((d) => (
                  <tr key={d.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 text-gray-900">
                      {d.labTestName ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-700">
                      {formatAmount(d.price)}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-700">
                      {formatAmount(d.amountRemise)}
                    </td>
                    <td className="px-4 py-3 text-right font-medium text-gray-900">
                      {formatAmount(d.amountAfterRemise)}
                    </td>
                    <td className="px-4 py-3">
                      <PermissionGate permission={PERMISSIONS.EDIT_CONTRACTS}>
                        <div className="flex items-center justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              setEditDetail(d);
                              setEditRemise(String(d.amountRemise ?? ""));
                            }}
                            className="inline-flex items-center justify-center rounded p-1.5 text-blue-600 hover:bg-blue-50 transition-colors"
                            title="Modifier la réduction"
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeleteDetail(d)}
                            className="inline-flex items-center justify-center rounded p-1.5 text-red-600 hover:bg-red-50 transition-colors"
                            title="Supprimer cette ligne"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </PermissionGate>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {!isClose && (
          <PermissionGate permission={PERMISSIONS.EDIT_CONTRACTS}>
            <div className="px-5 py-4 border-t border-gray-100">
              <button
                type="button"
                onClick={() => saveMutation.mutate()}
                disabled={details.length === 0 || saveMutation.isPending}
                className="w-full rounded-lg bg-green-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-green-700 transition-colors disabled:cursor-not-allowed disabled:opacity-50"
              >
                Sauvegarder
              </button>
            </div>
          </PermissionGate>
        )}
      </div>

      {/* ============ Modales ============ */}

      {/* Modifier la réduction d'une ligne */}
      <CrudModal
        isOpen={editDetail !== null}
        onClose={() => setEditDetail(null)}
        title="Modifier la réduction"
        onSubmit={() => updateDetailMutation.mutate()}
        submitLabel="Enregistrer"
        isSubmitting={updateDetailMutation.isPending}
      >
        <div className="flex flex-col gap-4">
          <FormField label="Examen">
            <input
              type="text"
              value={editDetail?.labTestName ?? ""}
              readOnly
              className={inputClass}
            />
          </FormField>
          <div className="grid grid-cols-2 gap-4">
            <FormField label="Prix">
              <input
                type="text"
                value={editDetail?.price ?? 0}
                readOnly
                className={inputClass}
              />
            </FormField>
            <FormField label="Total">
              <input
                type="text"
                value={editTotal}
                readOnly
                className={inputClass}
              />
            </FormField>
          </div>
          <FormField label="Réduction" required>
            <input
              type="number"
              value={editRemise}
              onChange={(e) => setEditRemise(e.target.value)}
              min={0}
              className={inputClass}
            />
          </FormField>
        </div>
      </CrudModal>

      {/* Confirmation suppression */}
      <ConfirmModal
        isOpen={deleteDetail !== null}
        onClose={() => setDeleteDetail(null)}
        onConfirm={() => {
          if (deleteDetail) deleteDetailMutation.mutate(deleteDetail.id);
        }}
        title="Supprimer cette ligne"
        message={`Supprimer "${deleteDetail?.labTestName ?? "cette ligne"}" du contrat ?`}
        confirmLabel="Supprimer"
        confirmVariant="danger"
        isLoading={deleteDetailMutation.isPending}
      />
    </div>
  );
}
