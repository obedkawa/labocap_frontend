"use client";

import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Search, PlusCircle } from "lucide-react";
import type { ColumnDef } from "@tanstack/react-table";
import type { AxiosError } from "axios";

import { PageHeader } from "@/components/ui/PageHeader";
import { DataTable } from "@/components/common/DataTable";
import { CrudModal } from "@/components/common/CrudModal";
import { usePermissions } from "@/hooks/usePermissions";
import { PERMISSIONS } from "@/lib/constants/permissions";
import {
  cashboxApi,
  type CashboxResponseDto,
  type CashboxOperationResponseDto,
} from "@/lib/api/cashbox";
import type { ApiError } from "@/types/api";

// ---------------------------------------------------------------------------
// Schéma de l'approvisionnement de la caisse
// ---------------------------------------------------------------------------

const supplySchema = z.object({
  amount: z.string().min(1, "Le montant est requis"),
  date: z.string().min(1, "La date est requise"),
  description: z.string().optional(),
});

type SupplyFormData = z.infer<typeof supplySchema>;

const inputClass =
  "w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatFCFA(amount: number): string {
  return new Intl.NumberFormat("fr-FR").format(amount) + " FCFA";
}

function formatDateTime(value: string): string {
  if (!value) return "—";
  const d = new Date(value);
  return (
    d.toLocaleDateString("fr-FR") +
    " " +
    d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })
  );
}

// ---------------------------------------------------------------------------
// Page — Caisse de dépense (réplique Laravel cashbox.depense.index)
// ---------------------------------------------------------------------------

export default function CashboxDepensePage() {
  const { can } = usePermissions();
  const queryClient = useQueryClient();

  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(20);
  const [supplyOpen, setSupplyOpen] = useState(false);

  // === Récupérer la caisse de dépense
  const { data: cashboxesData } = useQuery({
    queryKey: ["cashboxes"],
    queryFn: () => cashboxApi.getCashboxes().then((r) => r.data.content),
  });

  // Comme pour la caisse de vente, des doublons vides peuvent exister (artefacts
  // de migration) : on retient la caisse de type "depense" au solde le plus élevé.
  const depenseCashbox: CashboxResponseDto | undefined = (cashboxesData ?? [])
    .filter((c) => c.type === "depense")
    .reduce<CashboxResponseDto | undefined>(
      (best, c) =>
        !best || Number(c.balance ?? 0) > Number(best.balance ?? 0) ? c : best,
      undefined
    );

  // === Opérations de la caisse de dépense
  const { data: operationsData, isLoading } = useQuery({
    queryKey: ["cashbox-operations", { cashboxId: depenseCashbox?.id, page, pageSize }],
    queryFn: () =>
      cashboxApi
        .getOperations({ cashboxId: depenseCashbox!.id, page, size: pageSize })
        .then((r) => r.data),
    enabled: !!depenseCashbox?.id,
  });

  const allOperations = useMemo(
    () => operationsData?.content ?? [],
    [operationsData?.content]
  );

  const operations = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return allOperations;
    return allOperations.filter(
      (o) =>
        (o.description ?? "").toLowerCase().includes(q) ||
        String(o.amount).includes(q)
    );
  }, [allOperations, search]);

  const totalElements = operationsData?.totalElements ?? 0;
  const totalPages = operationsData?.totalPages ?? 0;

  // === Approvisionnement de la caisse (dépôt d'espèces dans la caisse de dépense)
  const supplyForm = useForm<SupplyFormData>({
    resolver: zodResolver(supplySchema),
    defaultValues: {
      amount: "",
      date: new Date().toISOString().split("T")[0],
      description: "",
    },
  });

  const supplyMutation = useMutation({
    mutationFn: (values: SupplyFormData) =>
      cashboxApi.addOperation({
        cashboxId: depenseCashbox!.id,
        amount: Number(values.amount),
        type: "CREDIT",
        description: values.description || undefined,
        operationDate: values.date,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cashboxes"] });
      queryClient.invalidateQueries({ queryKey: ["cashbox-operations"] });
      toast.success("Caisse approvisionnée");
      setSupplyOpen(false);
      supplyForm.reset({
        amount: "",
        date: new Date().toISOString().split("T")[0],
        description: "",
      });
    },
    onError: (err: AxiosError<ApiError>) => {
      toast.error(
        err.response?.data?.message ?? "Erreur lors de l'approvisionnement"
      );
    },
  });

  // ---- Columns — alignées sur la vue Laravel « Caisse de dépense » :
  // #, Date, Montant, Utilisateur.
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
      header: "Date",
      accessorKey: "createdAt",
      enableSorting: true,
      cell: ({ row }) => formatDateTime(row.original.createdAt),
    },
    {
      header: "Montant",
      accessorKey: "amount",
      enableSorting: true,
      cell: ({ row }) => {
        // Sortie de caisse (DEBIT) affichée en négatif, comme la vue Laravel
        // (bank ? amount : -amount).
        const isDebit = row.original.type === "DEBIT";
        return (
          <span
            className={`font-medium ${isDebit ? "text-red-600" : "text-green-700"}`}
          >
            {isDebit ? "-" : ""}
            {formatFCFA(row.original.amount)}
          </span>
        );
      },
    },
    {
      header: "Utilisateur",
      accessorKey: "userName",
      cell: ({ row }) => (
        <span className="text-sm text-gray-700">
          {row.original.userName ?? "—"}
        </span>
      ),
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
        title="Caisse de dépense"
        breadcrumbs={[
          { label: "Accueil", href: "/home" },
          { label: "Trésorerie" },
          { label: "Caisse de dépense" },
        ]}
        action={
          can(PERMISSIONS.MANAGE_CASHBOX) ? (
            <button
              type="button"
              onClick={() => {
                supplyForm.reset({
                  amount: "",
                  date: new Date().toISOString().split("T")[0],
                  description: "",
                });
                setSupplyOpen(true);
              }}
              disabled={!depenseCashbox}
              className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
              title="Approvisionner la caisse"
            >
              <PlusCircle className="h-4 w-4" />
              Approvisionner la caisse
            </button>
          ) : undefined
        }
      />

      {/* === KPI Solde actuel === */}
      {depenseCashbox && (
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <p className="text-xs uppercase tracking-wider text-gray-500">
            Solde actuel
          </p>
          <p className="mt-1 text-3xl font-bold text-green-700">
            {formatFCFA(depenseCashbox.balance)}
          </p>
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
          onPageSizeChange={(size) => {
            setPageSize(size);
            setPage(0);
          }}
        />
      </div>

      {/* === Modal approvisionnement === */}
      <CrudModal
        isOpen={supplyOpen}
        onClose={() => {
          setSupplyOpen(false);
          supplyForm.reset();
        }}
        title="Approvisionner la caisse"
        size="lg"
        onSubmit={supplyForm.handleSubmit((v) => supplyMutation.mutate(v))}
        submitLabel="Enregistrer"
        isSubmitting={supplyMutation.isPending}
      >
        <div className="grid grid-cols-1 gap-4">
          {depenseCashbox && (
            <p className="rounded-md bg-gray-50 px-3 py-2 text-xs text-gray-600">
              Solde caisse de dépense :{" "}
              <span className="font-semibold text-gray-800">
                {formatFCFA(depenseCashbox.balance)}
              </span>{" "}
              — le montant saisi sera ajouté à la caisse.
            </p>
          )}

          {/* Montant */}
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-gray-700">
              Montant (FCFA) <span className="text-red-500">*</span>
            </label>
            <input
              type="number"
              min={0}
              step="any"
              {...supplyForm.register("amount")}
              placeholder="0"
              className={inputClass}
            />
            {supplyForm.formState.errors.amount && (
              <p className="text-xs text-red-500">
                {supplyForm.formState.errors.amount.message}
              </p>
            )}
          </div>

          {/* Date */}
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-gray-700">
              Date <span className="text-red-500">*</span>
            </label>
            <input
              type="date"
              {...supplyForm.register("date")}
              className={inputClass}
            />
            {supplyForm.formState.errors.date && (
              <p className="text-xs text-red-500">
                {supplyForm.formState.errors.date.message}
              </p>
            )}
          </div>

          {/* Description */}
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-gray-700">
              Description
            </label>
            <textarea
              rows={3}
              {...supplyForm.register("description")}
              placeholder="Référence / commentaire (optionnel)"
              className={`${inputClass} resize-none`}
            />
          </div>
        </div>
      </CrudModal>
    </div>
  );
}
