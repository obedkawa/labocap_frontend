"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Check, X } from "lucide-react";
import type { ColumnDef } from "@tanstack/react-table";
import type { AxiosError } from "axios";
import type { UseFormReturn } from "react-hook-form";

import { PageHeader } from "@/components/ui/PageHeader";
import { DataTable } from "@/components/common/DataTable";
import { CrudModal } from "@/components/common/CrudModal";
import { PermissionGate } from "@/components/common/PermissionGate";
import { FormField } from "@/components/ui/FormField";
import { Badge } from "@/components/ui/Badge";
import { usePermissions } from "@/hooks/usePermissions";
import { PERMISSIONS } from "@/lib/constants/permissions";
import {
  refundsApi,
  refundReasonsApi,
  RefundRequest,
  RefundReason,
} from "@/lib/api/refunds";
import { invoicesApi, type Invoice } from "@/lib/api/invoices";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const inputClass =
  "w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:bg-gray-50";

function formatAmount(amount: number): string {
  return new Intl.NumberFormat("fr-FR").format(amount) + " FCFA";
}

function formatDate(dateStr: string): string {
  try {
    return new Date(dateStr).toLocaleDateString("fr-FR");
  } catch {
    return dateStr;
  }
}

function statusBadge(status: string) {
  if (status === "En attente")
    return <Badge variant="warning">En attente</Badge>;
  if (status === "Aprouvé")
    return <Badge variant="success">Approuvé</Badge>;
  if (status === "Clôturé")
    return <Badge variant="info">Clôturé</Badge>;
  // Valeur posée par reject() (cf. refundsApi.reject → status: "Rejeté")
  if (status === "Rejeté")
    return <Badge variant="danger">Rejeté</Badge>;
  return <Badge variant="danger">{status}</Badge>;
}

// ---------------------------------------------------------------------------
// Zod schema
// ---------------------------------------------------------------------------

const refundSchema = z.object({
  invoiceId: z.string().min(1, { message: "La facture est requise" }),
  refundReasonId: z.string().min(1, { message: "Le motif est requis" }),
  montant: z
    .string()
    .min(1, { message: "Le montant est requis" })
    .refine((v) => !isNaN(Number(v)) && Number(v) > 0, {
      message: "Montant invalide",
    }),
  note: z.string().optional(),
});

type RefundFormValues = z.infer<typeof refundSchema>;

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function RefundsPage() {
  return (
    <PermissionGate permission={PERMISSIONS.VIEW_REFUNDS}>
      <RefundsContent />
    </PermissionGate>
  );
}

function RefundsContent() {
  const { can } = usePermissions();
  const queryClient = useQueryClient();

  const [createOpen, setCreateOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState("");

  // ---- Query ---------------------------------------------------------------

  const params: Record<string, unknown> = { size: 1000 };
  if (statusFilter) params.status = statusFilter;

  const { data, isLoading } = useQuery({
    queryKey: ["refunds", params],
    queryFn: () => refundsApi.findAll(params).then((r) => r.data),
  });

  const refunds: RefundRequest[] = data?.content ?? [];

  // ---- Refund reasons query ------------------------------------------------

  const { data: reasonsData } = useQuery({
    queryKey: ["refund-reasons"],
    queryFn: () => refundReasonsApi.findAll().then((r) => r.data),
  });

  const reasons: RefundReason[] = Array.isArray(reasonsData) ? reasonsData : [];

  // ---- Invoices query (sélecteur de facture) ------------------------------

  const { data: invoicesData } = useQuery({
    queryKey: ["invoices", "refund-select"],
    queryFn: () => invoicesApi.findAll({ size: 1000 }).then((r) => r.data),
  });

  const invoices: Invoice[] = invoicesData?.content ?? [];

  function getReasonLabel(refundReasonId?: string): string {
    if (!refundReasonId) return "—";
    const found = reasons.find((r) => r.id === refundReasonId);
    return found ? found.label : "—";
  }

  // ---- Mutations -----------------------------------------------------------

  const createMutation = useMutation({
    mutationFn: (payload: {
      invoiceId: string;
      refundReasonId: string;
      montant: number;
      note?: string;
    }) => refundsApi.create(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["refunds"] });
      toast.success("Demande de remboursement créée");
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
    mutationFn: (id: string) => refundsApi.approve(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["refunds"] });
      toast.success("Remboursement approuvé");
    },
    onError: (err: AxiosError) => {
      const msg =
        (err.response?.data as { message?: string })?.message ??
        "Une erreur est survenue";
      toast.error(msg);
    },
  });

  const rejectMutation = useMutation({
    mutationFn: (id: string) => refundsApi.reject(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["refunds"] });
      toast.success("Remboursement rejeté");
    },
    onError: (err: AxiosError) => {
      const msg =
        (err.response?.data as { message?: string })?.message ??
        "Une erreur est survenue";
      toast.error(msg);
    },
  });

  // ---- Form ----------------------------------------------------------------

  const createForm = useForm<RefundFormValues>({
    resolver: zodResolver(refundSchema),
    defaultValues: { invoiceId: "", refundReasonId: "", montant: "", note: "" },
  });

  function onCreateSubmit(values: RefundFormValues) {
    createMutation.mutate({
      invoiceId: values.invoiceId,
      refundReasonId: values.refundReasonId,
      montant: Number(values.montant),
      note: values.note,
    });
  }

  // ---- Columns -------------------------------------------------------------

  const columns: ColumnDef<RefundRequest>[] = [
    {
      header: "Code",
      accessorKey: "code",
      cell: ({ row }) => (
        <span className="font-mono text-sm text-gray-700">
          {row.original.code ?? "—"}
        </span>
      ),
    },
    {
      header: "Référence facture",
      accessorKey: "invoiceId",
      cell: ({ row }) => (
        <span className="font-mono text-sm text-gray-700">
          {row.original.invoiceId}
        </span>
      ),
    },
    {
      header: "Montant demandé",
      accessorKey: "montant",
      cell: ({ row }) => (
        <span className="font-medium text-gray-900">
          {formatAmount(row.original.montant)}
        </span>
      ),
    },
    {
      header: "Motif",
      accessorKey: "refundReasonId",
      cell: ({ row }) => (
        <span className="text-sm text-gray-700">
          {getReasonLabel(row.original.refundReasonId)}
        </span>
      ),
    },
    {
      header: "Note",
      accessorKey: "note",
      cell: ({ row }) => (
        <span className="text-sm text-gray-500 line-clamp-2">
          {row.original.note ?? "—"}
        </span>
      ),
    },
    {
      header: "Statut",
      accessorKey: "status",
      cell: ({ row }) => statusBadge(row.original.status),
    },
    {
      header: "Date",
      accessorKey: "createdAt",
      cell: ({ row }) => formatDate(row.original.createdAt),
    },
    {
      header: "Actions",
      id: "actions",
      cell: ({ row }) => {
        const refund = row.original;
        if (refund.status !== "En attente") return null;

        return (
          <PermissionGate permission={PERMISSIONS.MANAGE_REFUNDS}>
            <div className="flex items-center gap-2">
              <button
                onClick={() => approveMutation.mutate(refund.id)}
                disabled={
                  approveMutation.isPending || rejectMutation.isPending
                }
                className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs font-medium bg-green-50 text-green-700 hover:bg-green-100 transition-colors disabled:opacity-50"
                aria-label="Approuver"
              >
                <Check className="h-3.5 w-3.5" />
                Approuver
              </button>
              <button
                onClick={() => rejectMutation.mutate(refund.id)}
                disabled={
                  approveMutation.isPending || rejectMutation.isPending
                }
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
        title="Remboursements"
        action={
          can(PERMISSIONS.MANAGE_REFUNDS) ? (
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

      {/* Filtre statut */}
      <div className="rounded-xl border border-gray-200 bg-white shadow-sm p-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className={inputClass}
          >
            <option value="">Tous les statuts</option>
            <option value="En attente">En attente</option>
            <option value="Aprouvé">Approuvé</option>
            <option value="Clôturé">Clôturé</option>
            <option value="Rejeté">Rejeté</option>
          </select>
        </div>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white shadow-sm p-5">
        <DataTable columns={columns} data={refunds} isLoading={isLoading} />
      </div>

      {/* Modal création */}
      <CrudModal
        isOpen={createOpen}
        onClose={() => setCreateOpen(false)}
        title="Nouvelle demande de remboursement"
        size="lg"
        onSubmit={createForm.handleSubmit(onCreateSubmit)}
        submitLabel="Soumettre"
        isSubmitting={createMutation.isPending}
      >
        <RefundForm form={createForm} reasons={reasons} invoices={invoices} />
      </CrudModal>
    </div>
  );
}

// ---------------------------------------------------------------------------
// RefundForm
// ---------------------------------------------------------------------------

interface RefundFormProps {
  form: UseFormReturn<RefundFormValues>;
  reasons: RefundReason[];
  invoices: Invoice[];
}

function RefundForm({ form, reasons, invoices }: RefundFormProps) {
  const {
    register,
    formState: { errors },
  } = form;

  return (
    <div className="space-y-4">
      <FormField
        label="Facture"
        required
        error={errors.invoiceId?.message}
      >
        <select {...register("invoiceId")} className={inputClass}>
          <option value="">Sélectionner une facture</option>
          {invoices.map((inv) => (
            <option key={inv.id} value={inv.id}>
              {inv.code} — {formatAmount(inv.total)}
              {inv.patientName ? ` (${inv.patientName})` : ""}
            </option>
          ))}
        </select>
      </FormField>

      <FormField
        label="Motif de remboursement"
        required
        error={errors.refundReasonId?.message}
      >
        <select {...register("refundReasonId")} className={inputClass}>
          <option value="">Sélectionner un motif</option>
          {reasons.map((r) => (
            <option key={r.id} value={r.id}>
              {r.label}
            </option>
          ))}
        </select>
      </FormField>

      <FormField
        label="Montant (FCFA)"
        required
        error={errors.montant?.message}
      >
        <input
          type="number"
          {...register("montant")}
          placeholder="0"
          min={0}
          className={inputClass}
        />
      </FormField>

      <FormField label="Note" error={errors.note?.message}>
        <textarea
          {...register("note")}
          rows={3}
          placeholder="Note optionnelle"
          className={inputClass}
        />
      </FormField>
    </div>
  );
}
