"use client";

import { use, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ArrowLeft, RefreshCw, CreditCard, XCircle, FileDown } from "lucide-react";
import { toast } from "sonner";
import type { AxiosError } from "axios";

import { RHFSelect } from "@/components/ui/RHFSelect";
import { usePermissions } from "@/hooks/usePermissions";
import { PERMISSIONS } from "@/lib/constants/permissions";
import { formatDate } from "@/lib/utils";
import { invoicesApi, type Invoice, type InvoiceDetail } from "@/lib/api/invoices";
import type { ApiError } from "@/types/api";

// ---------------------------------------------------------------------------
// Formatage montant FCFA
// ---------------------------------------------------------------------------

function formatFCFA(amount: number): string {
  return new Intl.NumberFormat("fr-FR").format(amount) + " FCFA";
}

// ---------------------------------------------------------------------------
// Schéma formulaire "Marquer payé"
// ---------------------------------------------------------------------------

const markPaidSchema = z.object({
  payment: z.enum(
    ["ESPECES", "MOBILEMONEY", "CARTEBANCAIRE", "CHEQUES", "VIREMENT", "CREDIT", "AUTRE"],
    { message: "Méthode requise" }
  ),
});

type MarkPaidFormValues = z.infer<typeof markPaidSchema>;

// ---------------------------------------------------------------------------
// Libellé méthode de paiement
// ---------------------------------------------------------------------------

function paymentLabel(payment?: string): string {
  switch (payment) {
    case "ESPECES":
      return "Espèces";
    case "MOBILEMONEY":
      return "Mobile Money";
    case "CARTEBANCAIRE":
      return "Carte bancaire";
    case "CHEQUES":
      return "Chèque";
    case "VIREMENT":
      return "Virement";
    case "CREDIT":
      return "Crédit";
    case "AUTRE":
      return "Autre";
    default:
      return "—";
  }
}

// ---------------------------------------------------------------------------
// Skeleton
// ---------------------------------------------------------------------------

function SkeletonLine({ className }: { className?: string }) {
  return <div className={`h-4 animate-pulse rounded bg-gray-200 ${className ?? ""}`} />;
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function InvoiceDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const queryClient = useQueryClient();
  const { can } = usePermissions();
  const canManage = can(PERMISSIONS.MANAGE_FINANCE);

  const [showMarkPaidForm, setShowMarkPaidForm] = useState(false);
  const [showMecefConfirmForm, setShowMecefConfirmForm] = useState(false);
  const [showMecefCancelForm, setShowMecefCancelForm] = useState(false);
  const [mecefUid, setMecefUid] = useState("");

  // --- Query : facture
  const { data: invoice, isLoading } = useQuery<Invoice>({
    queryKey: ["invoice", id],
    queryFn: () => invoicesApi.findById(id).then((r) => r.data),
    enabled: !!id,
  });

  // --- Formulaire "Marquer payé"
  const {
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<MarkPaidFormValues>({
    resolver: zodResolver(markPaidSchema),
    defaultValues: { payment: "ESPECES" },
  });

  // --- Mutation marquer payé
  const markPaidMutation = useMutation({
    mutationFn: (values: MarkPaidFormValues) =>
      invoicesApi.markAsPaid(id, { payment: values.payment }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["invoice", id] });
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
      toast.success("Facture marquée comme payée");
      reset();
      setShowMarkPaidForm(false);
    },
    onError: (err: AxiosError<ApiError>) => {
      toast.error(err.response?.data?.message ?? "Erreur lors du paiement");
    },
  });

  // --- Mutation confirm MECeF
  const confirmMecefMutation = useMutation({
    mutationFn: (uid: string) => invoicesApi.confirmMecef(id, uid),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["invoice", id] });
      toast.success("Synchronisation MECeF effectuée");
      setShowMecefConfirmForm(false);
      setMecefUid("");
    },
    onError: (err: AxiosError<ApiError>) => {
      toast.error(err.response?.data?.message ?? "Erreur synchronisation MECeF");
    },
  });

  // --- Mutation cancel MECeF
  const cancelMecefMutation = useMutation({
    mutationFn: (uid: string) => invoicesApi.cancelMecef(id, uid),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["invoice", id] });
      toast.success("Annulation MECeF effectuée");
      setShowMecefCancelForm(false);
      setMecefUid("");
    },
    onError: (err: AxiosError<ApiError>) => {
      toast.error(err.response?.data?.message ?? "Erreur annulation MECeF");
    },
  });

  const onSubmitMarkPaid = (values: MarkPaidFormValues) => {
    markPaidMutation.mutate(values);
  };

  // ---------------------------------------------------------------------------
  // Guard de permission
  // ---------------------------------------------------------------------------

  if (!can(PERMISSIONS.VIEW_INVOICES)) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-gray-500">Accès non autorisé</p>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // Rendu
  // ---------------------------------------------------------------------------

  return (
    <div className="space-y-6">
      {/* Barre haut : retour + PDF */}
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => router.back()}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-gray-600 hover:text-blue-600 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Retour à la liste
        </button>

        {invoice && (
          <button
            type="button"
            onClick={async () => {
              try {
                const res = await invoicesApi.downloadPdf(id);
                const blob = new Blob([res.data as BlobPart], { type: "application/pdf" });
                const url = URL.createObjectURL(blob);
                window.open(url, "_blank");
                setTimeout(() => URL.revokeObjectURL(url), 10000);
              } catch {
                toast.error("Erreur lors de la génération du PDF");
              }
            }}
            className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
          >
            <FileDown className="h-4 w-4" />
            Imprimer / PDF
          </button>
        )}
      </div>

      {isLoading ? (
        <div className="space-y-6">
          <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm space-y-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <SkeletonLine key={i} className="w-full" />
            ))}
          </div>
        </div>
      ) : !invoice ? (
        <div className="rounded-xl border border-gray-200 bg-white p-8 text-center shadow-sm">
          <p className="text-sm text-gray-500">Facture introuvable.</p>
        </div>
      ) : (
        <>
          {/* Titre dynamique conforme à Laravel (invoices/show) :
              reçu de paiement (vente) ou facture d'avoir. */}
          <h1 className="text-xl font-bold text-gray-900">
            {invoice.statusInvoice === 1
              ? `Facture d'avoir de ${invoice.code}`
              : `Reçu de paiement de ${invoice.testOrderCode ?? invoice.code}`}
          </h1>
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {/* -------------------------------------------------------
              Colonne gauche — Résumé facture
          ------------------------------------------------------- */}
          <div className="col-span-1 space-y-6">
            {/* Card récapitulatif */}
            <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
              <div className="flex items-start justify-between mb-4">
                <h2 className="text-base font-semibold text-gray-900">Facture</h2>
                {invoice.paid ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
                    Payé
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">
                    Non payé
                  </span>
                )}
              </div>

              <dl className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <dt className="text-gray-500">Code</dt>
                  <dd className="font-mono text-gray-800 font-medium">{invoice.code}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-gray-500">Type</dt>
                  <dd className="text-gray-700">
                    {invoice.statusInvoice === 0 ? "Vente" : "Avoir"}
                  </dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-gray-500">Date</dt>
                  <dd className="text-gray-700">{formatDate(invoice.createdAt)}</dd>
                </div>
                {invoice.dueDate && (
                  <div className="flex justify-between">
                    <dt className="text-gray-500">Échéance</dt>
                    <dd className="text-gray-700">{formatDate(invoice.dueDate)}</dd>
                  </div>
                )}
                {invoice.testOrderCode && (
                  <div className="flex justify-between">
                    <dt className="text-gray-500">Demande liée</dt>
                    <dd className="font-mono text-gray-700">{invoice.testOrderCode}</dd>
                  </div>
                )}
                {invoice.contratName && (
                  <div className="flex justify-between">
                    <dt className="text-gray-500">Contrat</dt>
                    <dd className="text-gray-700">{invoice.contratName}</dd>
                  </div>
                )}
              </dl>

              <hr className="my-4 border-gray-100" />

              {/* Montants */}
              <dl className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <dt className="text-gray-500">Total</dt>
                  <dd className="font-semibold text-gray-900">{formatFCFA(invoice.total)}</dd>
                </div>
                {invoice.paid && invoice.payment && (
                  <div className="flex justify-between">
                    <dt className="text-gray-500">Méthode</dt>
                    <dd className="text-gray-700">{paymentLabel(invoice.payment)}</dd>
                  </div>
                )}
                {invoice.codeMecef && (
                  <div className="flex justify-between">
                    <dt className="text-gray-500">Code MECeF</dt>
                    <dd className="font-mono text-xs text-gray-700">{invoice.codeMecef}</dd>
                  </div>
                )}
              </dl>
            </div>

            {/* Card infos patient */}
            {invoice.patientName && (
              <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
                <h2 className="mb-4 text-sm font-semibold text-gray-700">Informations patient</h2>
                <dl className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <dt className="text-gray-500">Nom</dt>
                    <dd className="font-medium text-gray-800">{invoice.patientName}</dd>
                  </div>
                </dl>
              </div>
            )}

            {/* Boutons actions — uniquement MANAGE_FINANCE */}
            {canManage && (
              <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm space-y-3">
                <h2 className="text-sm font-semibold text-gray-700">Actions</h2>

                {/* Marquer payé */}
                {!invoice.paid && (
                  <button
                    type="button"
                    onClick={() => setShowMarkPaidForm((v) => !v)}
                    className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-green-700"
                  >
                    <CreditCard className="h-4 w-4" />
                    Marquer comme payé
                  </button>
                )}

                {/* Confirm MECeF — uniquement si pas encore synchronisé ET facture payée */}
                {!invoice.codeMecef && invoice.paid && (
                  showMecefConfirmForm ? (
                  <div className="space-y-2 rounded-lg border border-blue-200 bg-blue-50 p-3">
                    <p className="text-xs font-medium text-blue-800">UID MECeF (confirmation)</p>
                    <input
                      type="text"
                      value={mecefUid}
                      onChange={(e) => setMecefUid(e.target.value)}
                      placeholder="Saisir l'UID MECeF"
                      className="w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => confirmMecefMutation.mutate(mecefUid)}
                        disabled={!mecefUid.trim() || confirmMecefMutation.isPending}
                        className="inline-flex flex-1 items-center justify-center gap-1 rounded-md bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                      >
                        {confirmMecefMutation.isPending ? (
                          <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <RefreshCw className="h-3.5 w-3.5" />
                        )}
                        Confirmer
                      </button>
                      <button
                        type="button"
                        onClick={() => { setShowMecefConfirmForm(false); setMecefUid(""); }}
                        className="rounded-md border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-100"
                      >
                        Annuler
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => { setShowMecefConfirmForm(true); setShowMecefCancelForm(false); setMecefUid(""); }}
                    className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700"
                  >
                    <RefreshCw className="h-4 w-4" />
                    Confirmer MECeF
                  </button>
                  )
                )}

                {/* Cancel MECeF */}
                {invoice.codeMecef && (
                  showMecefCancelForm ? (
                    <div className="space-y-2 rounded-lg border border-red-200 bg-red-50 p-3">
                      <p className="text-xs font-medium text-red-800">UID MECeF (annulation)</p>
                      <input
                        type="text"
                        value={mecefUid}
                        onChange={(e) => setMecefUid(e.target.value)}
                        placeholder="Saisir l'UID MECeF"
                        className="w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"
                      />
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => cancelMecefMutation.mutate(mecefUid)}
                          disabled={!mecefUid.trim() || cancelMecefMutation.isPending}
                          className="inline-flex flex-1 items-center justify-center gap-1 rounded-md bg-red-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-700 disabled:opacity-50"
                        >
                          {cancelMecefMutation.isPending ? (
                            <XCircle className="h-3.5 w-3.5 animate-pulse" />
                          ) : (
                            <XCircle className="h-3.5 w-3.5" />
                          )}
                          Annuler MECeF
                        </button>
                        <button
                          type="button"
                          onClick={() => { setShowMecefCancelForm(false); setMecefUid(""); }}
                          className="rounded-md border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-100"
                        >
                          Retour
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => { setShowMecefCancelForm(true); setShowMecefConfirmForm(false); setMecefUid(""); }}
                      className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-red-700"
                    >
                      <XCircle className="h-4 w-4" />
                      Annuler MECeF
                    </button>
                  )
                )}
              </div>
            )}

            {/* Formulaire marquer payé */}
            {canManage && !invoice.paid && showMarkPaidForm && (
              <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
                <h2 className="mb-4 text-sm font-semibold text-gray-700">
                  Méthode de paiement
                </h2>
                <form onSubmit={handleSubmit(onSubmitMarkPaid)} className="space-y-4">
                  <RHFSelect
                    control={control}
                    name="payment"
                    label="Méthode"
                    required
                    options={[
                      { value: "ESPECES", label: "Espèces" },
                      { value: "MOBILEMONEY", label: "Mobile Money" },
                      { value: "CARTEBANCAIRE", label: "Carte bancaire" },
                      { value: "CHEQUES", label: "Chèque" },
                      { value: "VIREMENT", label: "Virement" },
                      { value: "CREDIT", label: "Crédit" },
                      { value: "AUTRE", label: "Autre" },
                    ]}
                    error={errors.payment?.message}
                  />

                  <button
                    type="submit"
                    disabled={markPaidMutation.isPending}
                    className="inline-flex items-center gap-2 rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-green-700 disabled:opacity-50"
                  >
                    {markPaidMutation.isPending ? (
                      <RefreshCw className="h-4 w-4 animate-spin" />
                    ) : (
                      <CreditCard className="h-4 w-4" />
                    )}
                    Confirmer le paiement
                  </button>
                </form>
              </div>
            )}
          </div>

          {/* -------------------------------------------------------
              Colonne droite — Détails de la facture
          ------------------------------------------------------- */}
          <div className="col-span-2 space-y-6">
            {/* Tableau des détails */}
            <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
              <div className="border-b border-gray-100 px-5 py-4">
                <h2 className="text-sm font-semibold text-gray-700">Détails de la facture</h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="w-8 px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                        #
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                        Désignation
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-gray-500">
                        Quantité
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-gray-500">
                        Prix
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-gray-500">
                        Remise
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-gray-500">
                        Total
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {!invoice.details || invoice.details.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="px-4 py-6 text-center text-sm text-gray-500">
                          Aucun détail disponible
                        </td>
                      </tr>
                    ) : (
                      invoice.details.map((detail: InvoiceDetail, idx: number) => (
                        <tr key={detail.id} className="hover:bg-gray-50 transition-colors">
                          <td className="px-4 py-3 text-xs text-gray-400">{idx + 1}</td>
                          <td className="px-4 py-3 text-gray-800 font-medium">{detail.testName}</td>
                          <td className="px-4 py-3 text-right text-gray-600">{detail.quantity}</td>
                          <td className="px-4 py-3 text-right text-gray-600">
                            {formatFCFA(detail.unitPrice)}
                          </td>
                          <td className="px-4 py-3 text-right text-gray-600">
                            {detail.discount > 0 ? formatFCFA(detail.discount) : "—"}
                          </td>
                          <td className="px-4 py-3 text-right font-semibold text-gray-900">
                            {formatFCFA(detail.total)}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                  {invoice.details && invoice.details.length > 0 && (
                    <tfoot className="bg-gray-50">
                      <tr>
                        <td colSpan={5} className="px-4 py-3 text-right text-sm font-semibold text-gray-700">
                          Total
                        </td>
                        <td className="px-4 py-3 text-right text-sm font-bold text-gray-900">
                          {formatFCFA(invoice.total)}
                        </td>
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            </div>
          </div>
        </div>
        </>
      )}
    </div>
  );
}
