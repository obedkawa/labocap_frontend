"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Plus, ArrowDownCircle, ArrowUpCircle } from "lucide-react";
import type { ColumnDef } from "@tanstack/react-table";
import type { AxiosError } from "axios";

import { DataTable } from "@/components/common/DataTable";
import { CrudModal } from "@/components/common/CrudModal";
import { PageHeader } from "@/components/ui/PageHeader";
import { RHFSelect } from "@/components/ui/RHFSelect";
import { usePermissions } from "@/hooks/usePermissions";
import { PERMISSIONS } from "@/lib/constants/permissions";
import {
  inventoryApi,
  type Article,
  type StockMovement,
} from "@/lib/api/inventory";
import type { PageResponse, ApiError } from "@/types/api";
import { formatDate } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Zod schema — Entrée / Sortie (réplique du Laravel : augmenter / diminuer)
// ---------------------------------------------------------------------------

const movementSchema = z.object({
  articleId: z.string().min(1, "L'article est obligatoire"),
  type: z.enum(["IN", "OUT"]),
  quantity: z.string().min(1, "La quantité est requise"),
  notes: z.string().optional(),
});

type MovementFormData = z.infer<typeof movementSchema>;

const inputClass =
  "w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500";

// ---------------------------------------------------------------------------
// Helpers d'affichage
// ---------------------------------------------------------------------------

function TypeBadge({ type }: { type: StockMovement["type"] }) {
  const map: Record<StockMovement["type"], { label: string; cls: string }> = {
    IN: { label: "Entrée", cls: "bg-green-100 text-green-700" },
    OUT: { label: "Sortie", cls: "bg-orange-100 text-orange-700" },
    ADJUSTMENT: { label: "Ajustement", cls: "bg-gray-100 text-gray-700" },
  };
  const { label, cls } = map[type] ?? map.ADJUSTMENT;
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${cls}`}
    >
      {label}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Page principale
// ---------------------------------------------------------------------------

export default function MovementsPage() {
  const { can } = usePermissions();
  const queryClient = useQueryClient();

  // --- Pagination
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(10);

  // --- Modal
  const [createOpen, setCreateOpen] = useState(false);

  const form = useForm<MovementFormData>({
    resolver: zodResolver(movementSchema),
    defaultValues: { articleId: "", type: "IN", quantity: "", notes: "" },
  });

  // --- Query : liste des mouvements
  const { data, isLoading } = useQuery<PageResponse<StockMovement>>({
    queryKey: ["movements", { page, size: pageSize }],
    queryFn: () =>
      inventoryApi.listMovements({ page, size: pageSize }).then((r) => r.data),
  });

  // --- Query : articles (select + stock courant)
  const { data: articlesData } = useQuery<Article[]>({
    queryKey: ["articles-all-for-movements"],
    queryFn: () =>
      inventoryApi
        .findAll({ size: 1000 })
        .then((r) => r.data.articles.content),
    staleTime: 5 * 60_000,
  });

  const movements = data?.content ?? [];
  const pageCount = data?.totalPages ?? 0;
  const articles = articlesData ?? [];

  const selectedArticleId = form.watch("articleId");
  const selectedArticle = articles.find((a) => a.id === selectedArticleId);

  // --- Mutation : création (impacte le stock côté backend)
  const createMutation = useMutation({
    mutationFn: (values: MovementFormData) =>
      inventoryApi.addMovement(values.articleId, {
        type: values.type,
        quantity: Number(values.quantity),
        notes: values.notes || undefined,
        movementDate: new Date().toISOString().split("T")[0],
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["movements"] });
      // le stock de l'article a changé → rafraîchir les listes d'articles
      queryClient.invalidateQueries({ queryKey: ["articles"] });
      queryClient.invalidateQueries({ queryKey: ["articles-all-for-movements"] });
      toast.success("Mouvement enregistré");
      setCreateOpen(false);
      form.reset({ articleId: "", type: "IN", quantity: "", notes: "" });
    },
    onError: (err: AxiosError<ApiError>) => {
      toast.error(
        err.response?.data?.message ?? "Erreur lors de l'enregistrement",
      );
    },
  });

  function onSubmit(values: MovementFormData) {
    createMutation.mutate(values);
  }

  // --- Colonnes (ordre fidèle au Laravel : Article · Action · Date · Quantité · Utilisateur)
  const columns: ColumnDef<StockMovement>[] = [
    {
      header: "Article",
      id: "article",
      cell: ({ row }) =>
        row.original.articleName ?? row.original.article?.name ?? "—",
    },
    {
      header: "Action",
      accessorKey: "type",
      cell: ({ row }) => <TypeBadge type={row.original.type} />,
    },
    {
      header: "Date",
      id: "date",
      cell: ({ row }) => {
        const d = row.original.movementDate ?? row.original.createdAt;
        return d ? formatDate(d) : "—";
      },
    },
    {
      header: "Quantité",
      accessorKey: "quantity",
      cell: ({ row }) =>
        new Intl.NumberFormat("fr-FR").format(row.original.quantity),
    },
    {
      header: "Utilisateur",
      id: "user",
      cell: ({ row }) => row.original.userFullName ?? "—",
    },
  ];

  if (!can(PERMISSIONS.VIEW_ARTICLES)) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-gray-500">Accès non autorisé</p>
      </div>
    );
  }

  // --- Render
  return (
    <div className="space-y-6">
      <PageHeader
        title="Historique des stocks"
        subtitle="Historique des entrées et sorties de stock"
        action={
          can(PERMISSIONS.EDIT_ARTICLES) ? (
            <button
              type="button"
              onClick={() => {
                form.reset({
                  articleId: "",
                  type: "IN",
                  quantity: "",
                  notes: "",
                });
                setCreateOpen(true);
              }}
              className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700"
            >
              <Plus className="h-4 w-4" />
              Nouveau mouvement
            </button>
          ) : undefined
        }
      />

      <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <DataTable
          columns={columns}
          data={movements}
          isLoading={isLoading}
          pageCount={pageCount}
          pageIndex={page}
          pageSize={pageSize}
          onPageChange={setPage}
          onPageSizeChange={(size) => {
            setPageSize(size);
            setPage(0);
          }}
        />
      </div>

      {/* Modal création */}
      <CrudModal
        isOpen={createOpen}
        onClose={() => {
          setCreateOpen(false);
          form.reset();
        }}
        title="Nouveau mouvement de stock"
        size="lg"
        onSubmit={form.handleSubmit(onSubmit)}
        submitLabel="Enregistrer"
        isSubmitting={createMutation.isPending}
      >
        <div className="grid grid-cols-1 gap-4">
          {/* Article */}
          <div className="flex flex-col gap-1">
            <RHFSelect
              control={form.control}
              name="articleId"
              label="Article"
              required
              options={articles.map((a) => ({
                value: a.id,
                label: `${a.name}${a.code ? ` (${a.code})` : ""}`,
              }))}
              placeholder="Rechercher l'article..."
              error={form.formState.errors.articleId?.message}
            />
            {selectedArticle && (
              <p className="text-xs text-gray-500">
                Stock courant :{" "}
                <span className="font-medium text-gray-700">
                  {new Intl.NumberFormat("fr-FR").format(
                    selectedArticle.quantity,
                  )}
                  {selectedArticle.unit ? ` ${selectedArticle.unit}` : ""}
                </span>
              </p>
            )}
          </div>

          {/* Type de mouvement */}
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-gray-700">
              Type de mouvement <span className="text-red-500">*</span>
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label
                className={`flex cursor-pointer items-center justify-center gap-2 rounded-md border px-3 py-2 text-sm font-medium transition-colors ${
                  form.watch("type") === "IN"
                    ? "border-green-500 bg-green-50 text-green-700"
                    : "border-gray-300 text-gray-600 hover:bg-gray-50"
                }`}
              >
                <input
                  type="radio"
                  value="IN"
                  {...form.register("type")}
                  className="sr-only"
                />
                <ArrowDownCircle className="h-4 w-4" />
                Entrée
              </label>
              <label
                className={`flex cursor-pointer items-center justify-center gap-2 rounded-md border px-3 py-2 text-sm font-medium transition-colors ${
                  form.watch("type") === "OUT"
                    ? "border-orange-500 bg-orange-50 text-orange-700"
                    : "border-gray-300 text-gray-600 hover:bg-gray-50"
                }`}
              >
                <input
                  type="radio"
                  value="OUT"
                  {...form.register("type")}
                  className="sr-only"
                />
                <ArrowUpCircle className="h-4 w-4" />
                Sortie
              </label>
            </div>
          </div>

          {/* Quantité */}
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-gray-700">
              Quantité <span className="text-red-500">*</span>
            </label>
            <input
              type="number"
              min={0}
              step="any"
              {...form.register("quantity")}
              placeholder="0"
              className={inputClass}
            />
            {form.formState.errors.quantity && (
              <p className="text-xs text-red-500">
                {form.formState.errors.quantity.message}
              </p>
            )}
          </div>

          {/* Notes / motif */}
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-gray-700">
              Notes / Motif
            </label>
            <textarea
              rows={3}
              {...form.register("notes")}
              placeholder="Raison du mouvement (optionnel)"
              className={`${inputClass} resize-none`}
            />
          </div>
        </div>
      </CrudModal>
    </div>
  );
}
