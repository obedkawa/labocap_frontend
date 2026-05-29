"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Plus, Eye } from "lucide-react";
import { toast } from "sonner";
import type { AxiosError } from "axios";
import type { ColumnDef } from "@tanstack/react-table";

import { DataTable } from "@/components/common/DataTable";
import { CrudModal } from "@/components/common/CrudModal";
import { PageHeader } from "@/components/ui/PageHeader";
import { FormField } from "@/components/ui/FormField";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { usePermissions } from "@/hooks/usePermissions";
import { PERMISSIONS } from "@/lib/constants/permissions";
import {
  cashboxApi,
  type CashboxVoucherResponseDto,
  type CashboxVoucherCreateDto,
} from "@/lib/api/cashbox";
import { expenseCategoriesApi } from "@/lib/api/expenses";
import { suppliersApi } from "@/lib/api/suppliers";
import type { PageResponse, ApiError } from "@/types/api";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const inputClass =
  "w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500";

function formatAmount(v?: number) {
  if (v == null) return "—";
  return new Intl.NumberFormat("fr-FR").format(v) + " FCFA";
}

function formatDate(s?: string) {
  if (!s) return "—";
  return new Date(s).toLocaleDateString("fr-FR");
}

// ---------------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------------

const schema = z.object({
  description: z.string().min(1, "La description est requise"),
  supplierId: z.string().optional(),
  expenseCategoryId: z.string().optional(),
});

type FormData = z.infer<typeof schema>;

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function CashboxTicketsPage() {
  const { can } = usePermissions();
  const queryClient = useQueryClient();

  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(10);
  const [createOpen, setCreateOpen] = useState(false);
  const [detailTicket, setDetailTicket] = useState<CashboxVoucherResponseDto | null>(null);

  const form = useForm<FormData>({ resolver: zodResolver(schema) });

  // ---- Queries -------------------------------------------------------------

  const { data, isLoading } = useQuery<PageResponse<CashboxVoucherResponseDto>>({
    queryKey: ["cashbox-tickets", { page, size: pageSize }],
    queryFn: () =>
      cashboxApi.getVouchers({ page, size: pageSize }).then((r) => r.data),
  });

  const tickets = data?.content ?? [];
  const pageCount = data?.totalPages ?? 0;

  const { data: categoriesData } = useQuery({
    queryKey: ["expense-categories-all"],
    queryFn: () => expenseCategoriesApi.findAll({ size: 200 }).then((r) => r.data),
    enabled: createOpen,
  });

  const { data: suppliersData } = useQuery({
    queryKey: ["suppliers-all"],
    queryFn: () => suppliersApi.findAll({ size: 200 }).then((r) => r.data),
    enabled: createOpen,
  });

  const categories = categoriesData?.content ?? [];
  const suppliers = suppliersData?.content ?? [];

  // ---- Mutation ------------------------------------------------------------

  const createMutation = useMutation({
    mutationFn: (d: FormData) => {
      const payload: CashboxVoucherCreateDto = {
        description: d.description,
        supplierId: d.supplierId || undefined,
        expenseCategoryId: d.expenseCategoryId || undefined,
      };
      return cashboxApi.addVoucher(payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cashbox-tickets"] });
      toast.success("Ticket créé");
      setCreateOpen(false);
      form.reset();
    },
    onError: (e: AxiosError<ApiError>) =>
      toast.error(e.response?.data?.message ?? "Erreur lors de la création"),
  });

  // ---- Columns -------------------------------------------------------------

  const columns: ColumnDef<CashboxVoucherResponseDto>[] = [
    {
      header: "Code",
      accessorKey: "code",
      cell: ({ row }) => (
        <span className="font-mono text-xs text-gray-600">{row.original.code}</span>
      ),
    },
    {
      header: "Description",
      accessorKey: "description",
      cell: ({ row }) => row.original.description ?? "—",
    },
    {
      header: "Montant",
      accessorKey: "amount",
      cell: ({ row }) => formatAmount(row.original.amount),
    },
    {
      header: "Statut",
      accessorKey: "status",
      cell: ({ row }) => (
        <StatusBadge status={row.original.status} domain="general" />
      ),
    },
    {
      header: "Date",
      accessorKey: "createdAt",
      cell: ({ row }) => formatDate(row.original.createdAt),
    },
    {
      header: "Lignes",
      id: "details",
      cell: ({ row }) => (
        <span className="text-sm text-gray-600">
          {row.original.details?.length ?? 0} ligne(s)
        </span>
      ),
    },
    {
      header: "",
      id: "actions",
      cell: ({ row }) => (
        <button
          type="button"
          onClick={() => setDetailTicket(row.original)}
          className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs font-medium bg-blue-50 text-blue-700 hover:bg-blue-100 transition-colors"
          title="Voir les détails"
        >
          <Eye className="h-3.5 w-3.5" />
          Détail
        </button>
      ),
    },
  ];

  // ---- Render --------------------------------------------------------------

  return (
    <div className="space-y-6">
      <PageHeader
        title="Tickets de caisse"
        action={
          can(PERMISSIONS.VIEW_CASHBOXES) ? (
            <button
              type="button"
              onClick={() => { form.reset(); setCreateOpen(true); }}
              className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
            >
              <Plus className="h-4 w-4" />
              Nouveau ticket
            </button>
          ) : undefined
        }
      />

      <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <DataTable
          columns={columns}
          data={tickets}
          isLoading={isLoading}
          pageCount={pageCount}
          pageIndex={page}
          pageSize={pageSize}
          onPageChange={setPage}
          onPageSizeChange={(s) => { setPageSize(s); setPage(0); }}
        />
      </div>

      {/* Modal détail ticket */}
      {detailTicket && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-2xl rounded-xl bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
              <div>
                <h2 className="text-base font-semibold text-gray-900">
                  Ticket {detailTicket.code}
                </h2>
                <p className="text-sm text-gray-500">{detailTicket.description ?? "—"}</p>
              </div>
              <button
                onClick={() => setDetailTicket(null)}
                className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
              >
                ✕
              </button>
            </div>
            <div className="p-6">
              <div className="mb-4 flex items-center justify-between">
                <span className="text-sm text-gray-500">Total</span>
                <span className="text-base font-bold text-gray-900">{formatAmount(detailTicket.amount)}</span>
              </div>
              {detailTicket.details.length === 0 ? (
                <p className="py-6 text-center text-sm text-gray-500">Aucun article sur ce ticket.</p>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200 text-left text-xs font-medium text-gray-500 uppercase">
                      <th className="pb-2 pr-4">Article</th>
                      <th className="pb-2 pr-4 text-right">Qté</th>
                      <th className="pb-2 pr-4 text-right">Prix unit.</th>
                      <th className="pb-2 text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {detailTicket.details.map((d) => (
                      <tr key={d.id}>
                        <td className="py-2 pr-4 font-medium">{d.itemName}</td>
                        <td className="py-2 pr-4 text-right">{d.quantity}</td>
                        <td className="py-2 pr-4 text-right text-gray-600">{formatAmount(d.unitPrice)}</td>
                        <td className="py-2 text-right font-medium">{formatAmount(d.lineAmount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      )}

      <CrudModal
        isOpen={createOpen}
        onClose={() => { setCreateOpen(false); form.reset(); }}
        title="Nouveau ticket de caisse"
        onSubmit={form.handleSubmit((d) => createMutation.mutate(d))}
        submitLabel="Créer"
        isSubmitting={createMutation.isPending}
      >
        <div className="flex flex-col gap-4">
          <FormField label="Description" required error={form.formState.errors.description?.message}>
            <input
              type="text"
              {...form.register("description")}
              placeholder="Ex : Achat fournitures"
              className={inputClass}
            />
          </FormField>

          <FormField label="Catégorie de dépense" error={form.formState.errors.expenseCategoryId?.message}>
            <select {...form.register("expenseCategoryId")} className={inputClass}>
              <option value="">Sélectionner…</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </FormField>

          <FormField label="Fournisseur" error={form.formState.errors.supplierId?.message}>
            <select {...form.register("supplierId")} className={inputClass}>
              <option value="">Sélectionner…</option>
              {suppliers.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </FormField>
        </div>
      </CrudModal>
    </div>
  );
}
