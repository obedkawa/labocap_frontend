"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Pencil, Trash2, ArrowDownCircle, ArrowUpCircle, History } from "lucide-react";
import type { ColumnDef } from "@tanstack/react-table";
import type { AxiosError } from "axios";
import type { UseFormReturn } from "react-hook-form";

import { PageHeader } from "@/components/ui/PageHeader";
import { RHFSelect } from "@/components/ui/RHFSelect";
import { NativeSelect } from "@/components/ui/NativeSelect";
import { DataTable } from "@/components/common/DataTable";
import { CrudModal } from "@/components/common/CrudModal";
import { ConfirmModal } from "@/components/common/ConfirmModal";
import { PermissionGate } from "@/components/common/PermissionGate";
import { FormField } from "@/components/ui/FormField";
import { usePermissions } from "@/hooks/usePermissions";
import { PERMISSIONS } from "@/lib/constants/permissions";
import {
  inventoryApi,
  type Article,
  type ArticleRequest,
  type MovementRequest,
  type StockMovement,
} from "@/lib/api/inventory";
import { suppliersApi, type Supplier } from "@/lib/api/suppliers";

// ---------------------------------------------------------------------------
// Zod schemas
// ---------------------------------------------------------------------------

const articleSchema = z.object({
  name: z.string().min(1, "Le nom est requis"),
  code: z.string().optional(),
  supplierId: z.string().optional(),
  initialQuantity: z.string().min(1, "La quantité est requise"),
  unit: z.string().optional(),
  purchasePrice: z.string().min(1, "Le prix d'achat est requis"),
  minimumStock: z.string().optional(),
  description: z.string().optional(),
});

type ArticleFormValues = z.infer<typeof articleSchema>;

const movementSchema = z.object({
  quantity: z.string().min(1, "La quantité est requise"),
  notes: z.string().optional(),
});

type MovementFormValues = z.infer<typeof movementSchema>;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const inputClass =
  "w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:bg-gray-50 disabled:text-gray-500";

function formatPrice(price: number): string {
  return new Intl.NumberFormat("fr-FR").format(price) + " FCFA";
}

function buildArticlePayload(
  values: ArticleFormValues,
  includeInitialQuantity = true,
): ArticleRequest {
  const payload: ArticleRequest = {
    name: values.name,
    code: values.code || undefined,
    supplierId: values.supplierId || undefined,
    initialQuantity: Number(values.initialQuantity),
    purchasePrice: Number(values.purchasePrice),
    unit: values.unit || undefined,
    minimumStock:
      values.minimumStock === "" || values.minimumStock === undefined
        ? undefined
        : Number(values.minimumStock),
    description: values.description || undefined,
  };
  // En édition, on n'envoie JAMAIS initialQuantity : le backend ne touche pas
  // la quantité à l'update, mais on évite tout risque de réinitialisation du
  // stock. La quantité se gère uniquement via les mouvements (Entrée/Sortie).
  if (!includeInitialQuantity) {
    delete (payload as Partial<ArticleRequest>).initialQuantity;
  }
  return payload;
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function ArticlesPage() {
  const { can } = usePermissions();
  const queryClient = useQueryClient();

  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [movementOpen, setMovementOpen] = useState(false);
  const [movementType, setMovementType] = useState<"IN" | "OUT">("IN");
  const [selectedArticle, setSelectedArticle] = useState<Article | null>(null);
  const [historyArticle, setHistoryArticle] = useState<Article | null>(null);

  // ---- Filters -------------------------------------------------------
  const [search, setSearch] = useState("");
  const [filterSupplierId, setFilterSupplierId] = useState("");

  // ---- Queries -------------------------------------------------------

  const { data, isLoading } = useQuery({
    queryKey: ["articles"],
    // size élevé : recherche + filtre fournisseur opèrent côté client sur tout le stock.
    queryFn: () => inventoryApi.findAll({ size: 1000 }).then((r) => r.data),
  });

  const { data: suppliersData } = useQuery({
    queryKey: ["suppliers-list"],
    queryFn: () => suppliersApi.findAll({ size: 200 }).then((r) => r.data),
  });

  const articles: Article[] = data?.articles.content ?? [];
  const suppliers: Supplier[] = suppliersData?.content ?? [];

  const outOfStockCount = data?.outOfStockCount ?? 0;
  const lowStockCount = data?.lowStockCount ?? 0;

  const { data: movementsData, isLoading: movementsLoading } = useQuery({
    queryKey: ["article-movements", historyArticle?.id],
    queryFn: () => inventoryApi.getMovements(historyArticle!.id).then((r) => r.data),
    enabled: !!historyArticle,
  });

  // ---- Filtered list ------------------------------------------------

  const filteredArticles = articles.filter((a) => {
    const matchSearch =
      search === "" ||
      a.name.toLowerCase().includes(search.toLowerCase()) ||
      (a.code ?? "").toLowerCase().includes(search.toLowerCase());
    const matchSupplier =
      filterSupplierId === "" || a.supplierId === filterSupplierId;
    return matchSearch && matchSupplier;
  });

  // ---- Mutations -----------------------------------------------------

  const createMutation = useMutation({
    mutationFn: (payload: ArticleRequest) => inventoryApi.create(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["articles"] });
      toast.success("Article créé");
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

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<ArticleRequest> }) =>
      inventoryApi.update(id, data as ArticleRequest),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["articles"] });
      toast.success("Article modifié");
      setEditOpen(false);
    },
    onError: (err: AxiosError) => {
      const msg =
        (err.response?.data as { message?: string })?.message ??
        "Une erreur est survenue";
      toast.error(msg);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => inventoryApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["articles"] });
      toast.success("Article supprimé");
      setDeleteOpen(false);
      setSelectedArticle(null);
    },
    onError: (err: AxiosError) => {
      const msg =
        (err.response?.data as { message?: string })?.message ??
        "Une erreur est survenue";
      toast.error(msg);
    },
  });

  const movementMutation = useMutation({
    mutationFn: ({
      id,
      data,
    }: {
      id: string;
      data: MovementRequest;
    }) => inventoryApi.addMovement(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["articles"] });
      toast.success(
        movementType === "IN" ? "Entrée de stock enregistrée" : "Sortie de stock enregistrée"
      );
      setMovementOpen(false);
      movementForm.reset();
    },
    onError: (err: AxiosError) => {
      const msg =
        (err.response?.data as { message?: string })?.message ??
        "Une erreur est survenue";
      toast.error(msg);
    },
  });

  // ---- Forms --------------------------------------------------------

  const createForm = useForm<ArticleFormValues>({
    resolver: zodResolver(articleSchema),
    defaultValues: {
      name: "",
      code: "",
      supplierId: "",
      initialQuantity: "",
      unit: "",
      purchasePrice: "",
      minimumStock: "",
      description: "",
    },
  });

  const editForm = useForm<ArticleFormValues>({
    resolver: zodResolver(articleSchema),
  });

  const movementForm = useForm<MovementFormValues>({
    resolver: zodResolver(movementSchema),
    defaultValues: { quantity: "", notes: "" },
  });

  // ---- Handlers ------------------------------------------------------

  function openEdit(article: Article) {
    setSelectedArticle(article);
    editForm.reset({
      name: article.name,
      code: article.code ?? "",
      supplierId: article.supplierId ?? "",
      initialQuantity: String(article.quantity),
      unit: article.unit ?? "",
      purchasePrice: String(article.purchasePrice),
      minimumStock:
        article.minimumStock != null ? String(article.minimumStock) : "",
      description: article.description ?? "",
    });
    setEditOpen(true);
  }

  function openDelete(article: Article) {
    setSelectedArticle(article);
    setDeleteOpen(true);
  }

  function openMovement(article: Article, type: "IN" | "OUT") {
    setSelectedArticle(article);
    setMovementType(type);
    movementForm.reset({ quantity: "", notes: "" });
    setMovementOpen(true);
  }

  function onCreateSubmit(values: ArticleFormValues) {
    createMutation.mutate(buildArticlePayload(values));
  }

  function onEditSubmit(values: ArticleFormValues) {
    if (!selectedArticle) return;
    // includeInitialQuantity = false → la quantité n'est pas modifiée ici.
    updateMutation.mutate({
      id: selectedArticle.id,
      data: buildArticlePayload(values, false),
    });
  }

  function onMovementSubmit(values: MovementFormValues) {
    if (!selectedArticle) return;
    movementMutation.mutate({
      id: selectedArticle.id,
      data: {
        type: movementType,
        quantity: Number(values.quantity),
        notes: values.notes || undefined,
        movementDate: new Date().toISOString().split('T')[0],
      },
    });
  }

  // ---- Columns -------------------------------------------------------

  const columns: ColumnDef<Article>[] = [
    {
      header: "Code",
      accessorKey: "code",
      cell: ({ row }) => row.original.code ?? "—",
    },
    {
      header: "Nom",
      accessorKey: "name",
    },
    {
      header: "Fournisseur",
      id: "supplier",
      cell: ({ row }) => row.original.supplierName ?? "—",
    },
    {
      header: "Quantité",
      accessorKey: "quantity",
      cell: ({ row }) => {
        const { quantity, minimumStock } = row.original;
        const isLow =
          minimumStock != null && quantity < minimumStock;
        return (
          <span
            className={
              isLow
                ? "inline-flex items-center rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700"
                : "text-sm"
            }
          >
            {quantity}
          </span>
        );
      },
    },
    {
      header: "Unité",
      accessorKey: "unit",
      cell: ({ row }) => row.original.unit ?? "—",
    },
    {
      header: "Prix d'achat",
      accessorKey: "purchasePrice",
      cell: ({ row }) => formatPrice(row.original.purchasePrice),
    },
    {
      header: "Actions",
      id: "actions",
      cell: ({ row }) => (
        <div className="flex flex-wrap items-center gap-1.5">
          <PermissionGate permission={PERMISSIONS.EDIT_ARTICLES}>
            <button
              onClick={() => openEdit(row.original)}
              className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs font-medium bg-blue-600 text-white hover:bg-blue-700 transition-colors"
              aria-label="Modifier"
            >
              <Pencil className="h-3.5 w-3.5" />
              Modifier
            </button>
          </PermissionGate>
          <PermissionGate permission={PERMISSIONS.EDIT_ARTICLES}>
            <button
              onClick={() => openMovement(row.original, "IN")}
              className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs font-medium bg-green-50 text-green-700 hover:bg-green-100 transition-colors"
              aria-label="Entrée stock"
            >
              <ArrowDownCircle className="h-3.5 w-3.5" />
              Entrée
            </button>
          </PermissionGate>
          <PermissionGate permission={PERMISSIONS.EDIT_ARTICLES}>
            <button
              onClick={() => openMovement(row.original, "OUT")}
              className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs font-medium bg-orange-50 text-orange-700 hover:bg-orange-100 transition-colors"
              aria-label="Sortie stock"
            >
              <ArrowUpCircle className="h-3.5 w-3.5" />
              Sortie
            </button>
          </PermissionGate>
          <button
            onClick={() => setHistoryArticle(row.original)}
            className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs font-medium bg-purple-50 text-purple-700 hover:bg-purple-100 transition-colors"
            aria-label="Historique"
          >
            <History className="h-3.5 w-3.5" />
            Historique
          </button>
          <PermissionGate permission={PERMISSIONS.DELETE_ARTICLES}>
            <button
              onClick={() => openDelete(row.original)}
              className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs font-medium bg-red-600 text-white hover:bg-red-700 transition-colors"
              aria-label="Supprimer"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Supprimer
            </button>
          </PermissionGate>
        </div>
      ),
    },
  ];

  // ---- Render --------------------------------------------------------

  return (
    <div className="space-y-6">
      <PageHeader
        title="Articles"
        action={
          can(PERMISSIONS.CREATE_ARTICLES) ? (
            <button
              onClick={() => {
                createForm.reset();
                setCreateOpen(true);
              }}
              className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
            >
              Ajouter un article
            </button>
          ) : undefined
        }
      />

      {/* ---- Badges stock ---- */}
      {(outOfStockCount > 0 || lowStockCount > 0) && (
        <div className="flex flex-wrap gap-3">
          {outOfStockCount > 0 && (
            <span className="inline-flex items-center rounded-full bg-red-100 px-3 py-1 text-xs font-medium text-red-700">
              {outOfStockCount} article{outOfStockCount > 1 ? "s" : ""} en rupture
            </span>
          )}
          {lowStockCount > 0 && (
            <span className="inline-flex items-center rounded-full bg-orange-100 px-3 py-1 text-xs font-medium text-orange-700">
              {lowStockCount} article{lowStockCount > 1 ? "s" : ""} en stock bas
            </span>
          )}
        </div>
      )}

      {/* ---- Filtres ---- */}
      <div className="flex flex-wrap gap-3">
        <input
          type="text"
          placeholder="Rechercher par nom ou code…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 w-64"
        />
        <NativeSelect
          value={filterSupplierId}
          onChange={(e) => setFilterSupplierId(e.target.value)}
        >
          <option value="">Tous les fournisseurs</option>
          {suppliers.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </NativeSelect>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white shadow-sm p-5">
        <DataTable
          columns={columns}
          data={filteredArticles}
          isLoading={isLoading}
        />
      </div>

      {/* ---- Modal création ---- */}
      <CrudModal
        isOpen={createOpen}
        onClose={() => setCreateOpen(false)}
        title="Ajouter un article"
        size="lg"
        onSubmit={createForm.handleSubmit(onCreateSubmit)}
        submitLabel="Ajouter un article"
        isSubmitting={createMutation.isPending}
      >
        <ArticleForm form={createForm} suppliers={suppliers} />
      </CrudModal>

      {/* ---- Modal édition ---- */}
      <CrudModal
        isOpen={editOpen}
        onClose={() => setEditOpen(false)}
        title="Modifier un article"
        size="lg"
        onSubmit={editForm.handleSubmit(onEditSubmit)}
        submitLabel="Modifier"
        isSubmitting={updateMutation.isPending}
      >
        <ArticleForm form={editForm} suppliers={suppliers} isEdit />
      </CrudModal>

      {/* ---- Modal mouvement de stock ---- */}
      <CrudModal
        isOpen={movementOpen}
        onClose={() => {
          setMovementOpen(false);
          setSelectedArticle(null);
        }}
        title={
          movementType === "IN"
            ? `Entrée de stock — ${selectedArticle?.name ?? ""}`
            : `Sortie de stock — ${selectedArticle?.name ?? ""}`
        }
        size="md"
        onSubmit={movementForm.handleSubmit(onMovementSubmit)}
        submitLabel={movementType === "IN" ? "Enregistrer l'entrée" : "Enregistrer la sortie"}
        isSubmitting={movementMutation.isPending}
      >
        <MovementForm form={movementForm} />
      </CrudModal>

      {/* ---- Modal confirmation suppression ---- */}
      <ConfirmModal
        isOpen={deleteOpen}
        onClose={() => {
          setDeleteOpen(false);
          setSelectedArticle(null);
        }}
        onConfirm={() => {
          if (selectedArticle) deleteMutation.mutate(selectedArticle.id);
        }}
        title="Supprimer cet article"
        message={`Voulez-vous vraiment supprimer l'article "${selectedArticle?.name ?? ""}" ? Cette action est irréversible.`}
        confirmLabel="Supprimer"
        confirmVariant="danger"
        isLoading={deleteMutation.isPending}
      />

      {/* ---- Modal historique des mouvements ---- */}
      {historyArticle && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-2xl rounded-xl bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
              <h2 className="text-base font-semibold text-gray-900">
                Historique — {historyArticle.name}
              </h2>
              <button
                onClick={() => setHistoryArticle(null)}
                className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
              >
                ✕
              </button>
            </div>
            <div className="max-h-96 overflow-y-auto p-6">
              {movementsLoading ? (
                <div className="flex justify-center py-8">
                  <div className="h-6 w-6 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
                </div>
              ) : (movementsData?.content ?? []).length === 0 ? (
                <p className="py-8 text-center text-sm text-gray-500">
                  Aucun mouvement enregistré pour cet article.
                </p>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200 text-left text-xs font-medium text-gray-500 uppercase">
                      <th className="pb-2 pr-4">Type</th>
                      <th className="pb-2 pr-4">Quantité</th>
                      <th className="pb-2 pr-4">Date</th>
                      <th className="pb-2">Notes</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {(movementsData?.content ?? []).map((m: StockMovement) => (
                      <tr key={m.id}>
                        <td className="py-2 pr-4">
                          <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                            m.type === "IN"
                              ? "bg-green-50 text-green-700"
                              : m.type === "OUT"
                              ? "bg-orange-50 text-orange-700"
                              : "bg-gray-50 text-gray-700"
                          }`}>
                            {m.type === "IN" ? "Entrée" : m.type === "OUT" ? "Sortie" : "Ajustement"}
                          </span>
                        </td>
                        <td className="py-2 pr-4 font-medium">{m.quantity}</td>
                        <td className="py-2 pr-4 text-gray-500">
                          {m.movementDate ? new Date(m.movementDate).toLocaleDateString("fr-FR") : "—"}
                        </td>
                        <td className="py-2 text-gray-500">{m.notes ?? "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// ArticleForm
// ---------------------------------------------------------------------------

interface ArticleFormProps {
  form: UseFormReturn<ArticleFormValues>;
  suppliers: Supplier[];
  /** En édition, la quantité ne se modifie pas via ce champ (mouvements de stock). */
  isEdit?: boolean;
}

function ArticleForm({ form, suppliers, isEdit = false }: ArticleFormProps) {
  const {
    register,
    control,
    formState: { errors },
  } = form;

  return (
    <div className="grid grid-cols-1 gap-4">
      <FormField label="Nom" required error={errors.name?.message}>
        <input
          type="text"
          {...register("name")}
          placeholder="Nom de l'article"
          className={inputClass}
        />
      </FormField>

      <FormField label="Code" error={errors.code?.message}>
        <input
          type="text"
          {...register("code")}
          placeholder="CODE-001"
          className={inputClass}
        />
      </FormField>

      <RHFSelect
        control={control}
        name="supplierId"
        label="Fournisseur"
        options={suppliers.map((s) => ({ value: s.id, label: s.name }))}
        placeholder="Rechercher un fournisseur..."
        error={errors.supplierId?.message}
        isClearable
      />

      <FormField
        label={isEdit ? "Quantité en stock" : "Quantité initiale"}
        required={!isEdit}
        error={errors.initialQuantity?.message}
        hint={
          isEdit
            ? "Non modifiable ici — utilisez les mouvements de stock (Entrée / Sortie)."
            : undefined
        }
      >
        <input
          type="number"
          {...register("initialQuantity")}
          min={0}
          placeholder="0"
          disabled={isEdit}
          className={inputClass}
        />
      </FormField>

      <FormField label="Unité" error={errors.unit?.message}>
        <input
          type="text"
          {...register("unit")}
          placeholder="ex : pièce, boîte, litre"
          className={inputClass}
        />
      </FormField>

      <FormField
        label="Prix d'achat (FCFA)"
        required
        error={errors.purchasePrice?.message}
      >
        <input
          type="number"
          {...register("purchasePrice")}
          min={0}
          placeholder="0"
          className={inputClass}
        />
      </FormField>

      <FormField
        label="Stock minimum"
        error={errors.minimumStock?.message}
      >
        <input
          type="number"
          {...register("minimumStock")}
          min={0}
          placeholder="0"
          className={inputClass}
        />
      </FormField>

      <div className="sm:col-span-2">
        <FormField label="Description" error={errors.description?.message}>
          <textarea
            {...register("description")}
            rows={3}
            placeholder="Description de l'article…"
            className={inputClass}
          />
        </FormField>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// MovementForm
// ---------------------------------------------------------------------------

interface MovementFormProps {
  form: UseFormReturn<MovementFormValues>;
}

function MovementForm({ form }: MovementFormProps) {
  const {
    register,
    formState: { errors },
  } = form;

  return (
    <div className="grid grid-cols-1 gap-4">
      <FormField label="Quantité" required error={errors.quantity?.message}>
        <input
          type="number"
          {...register("quantity")}
          min={1}
          placeholder="0"
          className={inputClass}
        />
      </FormField>

      <FormField label="Notes / Motif" error={errors.notes?.message}>
        <input
          type="text"
          {...register("notes")}
          placeholder="Raison du mouvement"
          className={inputClass}
        />
      </FormField>
    </div>
  );
}
