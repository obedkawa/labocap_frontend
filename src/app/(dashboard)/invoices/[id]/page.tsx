"use client";

import { use, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import type { AxiosError } from "axios";
import type { ColumnDef } from "@tanstack/react-table";

import { DataTable } from "@/components/common/DataTable";
import { NativeSelect } from "@/components/ui/NativeSelect";
import { usePermissions } from "@/hooks/usePermissions";
import { useAppSettings } from "@/hooks/useAppSettings";
import { PERMISSIONS } from "@/lib/constants/permissions";
import {
  invoicesApi,
  type Invoice,
  type InvoiceDetail,
  type InvoicePayment,
} from "@/lib/api/invoices";
import type { ApiError } from "@/types/api";

// ---------------------------------------------------------------------------
// Formatage — calqué sur `invoices/show.blade.php`
// ---------------------------------------------------------------------------

/** `number_format(abs($v), 0, ',', ' ')` : millier séparé par une espace. */
function formatMontant(value?: number): string {
  return new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 })
    .format(Math.abs(value ?? 0))
    .replace(/ | /g, " ");
}

/** `price` et `discount` sont des `double` : PHP les rend sans décimale inutile. */
function formatDouble(value?: number): string {
  if (value == null) return "";
  return Number.isInteger(value) ? String(value) : String(value);
}

/** `total` est un `numeric(10,2)` : PHP le rend toujours avec 2 décimales. */
function formatDecimal2(value?: number): string {
  return (value ?? 0).toFixed(2);
}

/** `$invoice->created_at` s'affiche au format « 2026-07-16 12:58:06 ». */
function formatDateTimeSql(value?: string): string {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  const p = (n: number) => String(n).padStart(2, "0");
  return (
    `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ` +
    `${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`
  );
}

/** Helper Laravel `remove_hyphen` : « 26-0005 » → « 260005 ». */
function removeHyphen(code?: string): string {
  return (code ?? "").replace(/-/g, "");
}

/** Une ligne du tableau de la facture, déjà formatée pour l'affichage. */
interface InvoiceLine {
  id: string;
  designation: string;
  prix: string;
  remise: string;
  total: string;
}

const lineColumns: ColumnDef<InvoiceLine>[] = [
  {
    header: "#",
    id: "index",
    enableSorting: false,
    cell: ({ row }) => row.index + 1,
  },
  {
    header: "Désignation",
    accessorKey: "designation",
    cell: ({ row }) => <b>{row.original.designation}</b>,
  },
  {
    header: "Quantité",
    id: "quantite",
    enableSorting: false,
    // Laravel affiche toujours 1 : la quantité n'est pas gérée sur les lignes.
    cell: () => "1",
  },
  { header: "Prix", accessorKey: "prix" },
  { header: "Remise", accessorKey: "remise" },
  {
    header: "Total",
    accessorKey: "total",
    cell: ({ row }) => <span className="block text-right">{row.original.total}</span>,
  },
];

const NOTE_IMPORTANTE =
  "Les résultats de vos analyses seront disponibles dans un délai de 3 semaines. " +
  "Selon la complexité du cas, les résultats peuvent être disponibles plus tôt ou plus tard. " +
  "Vous serez notifiés dès que les résultats seront prêts. Nous vous remercions de votre " +
  "compréhension et de votre patience.";

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function InvoiceDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const queryClient = useQueryClient();
  const { can } = usePermissions();

  const [payment, setPayment] = useState<InvoicePayment>("ESPECES");
  const [codeNormalise, setCodeNormalise] = useState("");

  const { data: invoice, isLoading } = useQuery<Invoice>({
    queryKey: ["invoice", id],
    queryFn: () => invoicesApi.findById(id).then((r) => r.data),
    enabled: !!id,
  });

  const { data: appSettings } = useAppSettings();
  const reportFooter = appSettings?.report_footer;

  const markPaidMutation = useMutation({
    mutationFn: () =>
      invoicesApi.markAsPaid(id, {
        payment,
        ...(codeNormalise ? { codeNormalise } : {}),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["invoice", id] });
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
      toast.success("Facture marquée comme payée");
    },
    onError: (err: AxiosError<ApiError>) => {
      toast.error(err.response?.data?.message ?? "Erreur lors du paiement");
    },
  });

  /** « Voir tout » : ouvre le document complet en PDF. */
  async function openPdf() {
    try {
      const res = await invoicesApi.downloadPdf(id);
      const blob = new Blob([res.data as BlobPart], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      window.open(url, "_blank");
      setTimeout(() => URL.revokeObjectURL(url), 10000);
    } catch {
      toast.error("Erreur lors de la génération du PDF");
    }
  }

  if (!can(PERMISSIONS.VIEW_INVOICES)) {
    return (
      <div className="flex h-64 items-center justify-center">
        <p className="text-gray-500">Accès non autorisé</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="space-y-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-4 animate-pulse rounded bg-gray-200" />
          ))}
        </div>
      </div>
    );
  }

  if (!invoice) {
    return (
      <div className="rounded-xl border border-gray-200 bg-white p-8 text-center shadow-sm">
        <p className="text-sm text-gray-500">Facture introuvable.</p>
      </div>
    );
  }

  const isAvoir = invoice.statusInvoice === 1;
  const refund = invoice.refund;

  /**
   * Lignes du tableau. Un avoir n'en porte qu'une, reprenant la raison du
   * remboursement ; une facture de vente liste ses prestations.
   */
  const lines: InvoiceLine[] = refund
    ? [
        {
          id: "refund",
          designation: refund.reasonDescription ?? "",
          prix: formatDouble(refund.montant),
          remise: "0.0 ",
          total: formatDouble(refund.montant),
        },
      ]
    : (invoice.details ?? []).map((item: InvoiceDetail) => ({
        id: item.id,
        designation: item.testName,
        prix: formatDouble(item.price),
        remise: formatDouble(item.discount),
        total: formatDecimal2(item.total),
      }));

  // Titre : « Reçu de paiement de {code demande} » ou « Facture d'avoir ».
  const title =
    (isAvoir ? "Facture d'avoir" : "Reçu de paiement") +
    (invoice.testOrderCode ? ` de ${invoice.testOrderCode}` : "");

  // Le bloc d'encaissement n'apparaît que sur une facture impayée.
  const showPaymentBlock = !invoice.paid && can(PERMISSIONS.VIEW_CASHIER);

  return (
    <div className="space-y-6">
      {/* ---- Titre de page, suivi du bouton « Voir tout » ---- */}
      <div className="flex items-center gap-3">
        <h4 className="text-xl font-semibold text-gray-700">{title}</h4>
        <button
          type="button"
          onClick={openPdf}
          className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700"
        >
          Voir tout
        </button>
      </div>

      {/* ---- Document ---- */}
      <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        {/* Filet de tête (comme le <hr> du reçu Laravel) */}
        <hr className="border-gray-200" />

        {/* En-tête : facture · client · QR */}
        <div className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-3">
          {/* Colonne 1 — la facture */}
          <div className="space-y-2 text-[15px] text-gray-700">
            <p>
              <strong>{isAvoir ? "Facture d'avoir" : "Facture de vente"}</strong>
            </p>
            <p>
              <strong>Date: </strong> {formatDateTimeSql(invoice.createdAt)}
            </p>
            <p>
              <strong>Code: </strong>
              <span>{isAvoir ? (refund?.code ?? "") : invoice.code}</span>{" "}
              <span className="font-bold uppercase">
                {invoice.paid ? "[Payé]" : "[En attente]"}
              </span>
            </p>
            <p>
              {/* La facture affiche « Référence » (code de la facture d'origine
                  pour un avoir, vide pour une vente), et non le contrat. */}
              <strong>Référence: </strong>
              <span>
                {isAvoir
                  ? (refund?.invoiceCode ?? invoice.referenceCode ?? "")
                  : (invoice.referenceCode ?? "")}
              </span>
            </p>
            <p>
              <strong>CODE MECeF / DGI: </strong>
              <span className="uppercase"> {invoice.codeNormalise ?? ""}</span>
            </p>
          </div>

          {/* Colonne 2 — le destinataire */}
          <div className="space-y-2 text-[15px] text-gray-700">
            <p>
              <strong>Adressée à:</strong>
            </p>
            <p>
              <strong>Nom: </strong> {invoice.clientName ?? ""}
            </p>
            <p>
              {/* Laravel affiche ici le patient s'il existe, sinon l'adresse client. */}
              <strong>Adresse: </strong>
              <span>{invoice.patientName ?? invoice.clientAddress ?? ""}</span>
            </p>
            <p>
              <strong>Code client: </strong>
              <span className="uppercase">{invoice.patientCode ?? ""}</span>
            </p>
            <p>
              {/* `telephone1`/`telephone2` n'existent pas en base : vide, comme en Laravel. */}
              <strong>Contact client: </strong>
              <span> </span>
            </p>
            <p>
              <strong>Demande d&apos;examen: </strong>
              <span>{removeHyphen(invoice.testOrderCode)}</span>
            </p>
          </div>

          {/* Colonne 3 — QR code de la facture, sur la même ligne que l'en-tête */}
          <div className="flex justify-end">
            {invoice.qrcode ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={
                  invoice.qrcode.startsWith("data:")
                    ? invoice.qrcode
                    : `data:image/png;base64,${invoice.qrcode}`
                }
                alt="QR Code"
                width={150}
                height={150}
              />
            ) : null}
          </div>
        </div>

        {/* Lignes de la facture — rendu par le DataTable de l'application */}
        <div className="mt-4">
          <DataTable
            columns={lineColumns}
            data={lines}
            hideToolbar
            hideToolbarSearch
          />
        </div>

        {/* Totaux, alignés à droite */}
        <div className="mt-3 flex justify-end">
          <div className="w-64 text-sm text-gray-700">
            <p className="flex justify-between">
              <b>Sous-total : </b>
              <span>{formatMontant(invoice.subtotal)}</span>
            </p>
            <p className="mt-1 text-right">
              <b>Montant TTC : </b>
              {formatMontant(invoice.total)} FCFA
            </p>
          </div>
        </div>

        {/* Encaissement — uniquement sur une facture impayée */}
        {showPaymentBlock && (
          <div className="mt-4 grid grid-cols-1 items-end gap-4 md:grid-cols-3">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Type de paiement
              </label>
              <NativeSelect
                value={payment}
                onChange={(e) => setPayment(e.target.value as InvoicePayment)}
              >
                <option value="ESPECES">ESPECES</option>
                <option value="MOBILEMONEY">MOBILE MONEY</option>
                <option value="CHEQUES">CHEQUES</option>
                <option value="VIREMENT">VIREMENT</option>
              </NativeSelect>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Code de la facture normalisée
              </label>
              <input
                type="text"
                value={codeNormalise}
                onChange={(e) => setCodeNormalise(e.target.value)}
                placeholder="Code MECeF/DGI"
                minLength={24}
                maxLength={24}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>

            <div>
              <button
                type="button"
                onClick={() => markPaidMutation.mutate()}
                disabled={markPaidMutation.isPending}
                className="inline-flex items-center gap-2 rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-green-700 disabled:opacity-50"
              >
                Terminer la facture
              </button>
            </div>
          </div>
        )}

        {/* Note importante */}
        <div className="mt-10 border border-black">
          <p className="m-0 p-1 text-sm text-gray-800">
            <b>Note importante :</b> {NOTE_IMPORTANTE}
          </p>
        </div>

        {/* Pied de page du laboratoire */}
        {reportFooter ? (
          <p className="mt-8 text-center text-xs text-gray-600">{reportFooter}</p>
        ) : null}
      </div>
    </div>
  );
}
