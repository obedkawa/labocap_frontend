"use client";

import { use, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import {
  ArrowLeft,
  Plus,
  Trash2,
  CheckCircle,
  XCircle,
  Tag,
  FlaskConical,
} from "lucide-react";
import Link from "next/link";
import type { AxiosError } from "axios";

import { PageHeader } from "@/components/ui/PageHeader";
import { RHFSelect } from "@/components/ui/RHFSelect";
import { CrudModal } from "@/components/common/CrudModal";
import { ConfirmModal } from "@/components/common/ConfirmModal";
import { PermissionGate } from "@/components/common/PermissionGate";
import { FormField } from "@/components/ui/FormField";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { usePermissions } from "@/hooks/usePermissions";
import { PERMISSIONS } from "@/lib/constants/permissions";
import { contractsApi, type ContractDetail } from "@/lib/api/contracts";
import { categoryTestsApi, labTestsApi } from "@/lib/api/examens";
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
  "w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500";

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

const categoryDetailSchema = z.object({
  categoryTestId: z.string().min(1, "La catégorie est requise"),
  discount: z.string().min(1, "La remise est requise"),
});
type CategoryDetailForm = z.infer<typeof categoryDetailSchema>;

const testDetailSchema = z.object({
  testId: z.string().min(1, "L'examen est requis"),
  amountRemise: z.string().min(1, "Montant remise requis"),
  amountAfterRemise: z.string().min(1, "Montant après remise requis"),
});
type TestDetailForm = z.infer<typeof testDetailSchema>;

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

  const { can } = usePermissions();
  const queryClient = useQueryClient();

  const [addCatOpen, setAddCatOpen] = useState(false);
  const [addTestOpen, setAddTestOpen] = useState(false);
  const [deleteDetail, setDeleteDetail] = useState<ContractDetail | null>(null);

  // ---- Query ---------------------------------------------------------------

  const { data: contract, isLoading } = useQuery({
    queryKey: ["contract", contractId],
    queryFn: () => contractsApi.findById(contractId).then((r) => r.data),
  });

  // Chargé indépendamment (pas seulement à l'ouverture du modal) afin de
  // pouvoir résoudre le nom des catégories dans le tableau des lignes.
  const { data: categoriesData } = useQuery({
    queryKey: ["category-tests-all"],
    queryFn: () => categoryTestsApi.findAll({ size: 200 }).then((r) => r.data),
  });

  const { data: examensData } = useQuery({
    queryKey: ["examens-all"],
    queryFn: () => labTestsApi.findAll({ size: 200 }).then((r) => r.data),
    enabled: addTestOpen,
  });

  const categories = categoriesData?.content ?? [];
  const examens = examensData?.content ?? [];

  // Résout le nom d'une catégorie à partir de son id (lignes de contrat ajoutées
  // par catégorie, qui n'ont pas de labTestName).
  function getCategoryName(categoryTestId?: string): string | null {
    if (!categoryTestId) return null;
    const found = categories.find((c) => c.id === categoryTestId);
    return found?.name ?? null;
  }

  // ---- Mutations -----------------------------------------------------------

  const addCategoryMutation = useMutation({
    mutationFn: (d: CategoryDetailForm) =>
      contractsApi.addDetail(contractId, {
        categoryTestId: d.categoryTestId,
        discount: Number(d.discount),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["contract", contractId] });
      toast.success("Ligne catégorie ajoutée");
      setAddCatOpen(false);
      catForm.reset();
    },
    onError: (e: AxiosError<ApiError>) =>
      toast.error(e.response?.data?.message ?? "Erreur"),
  });

  const addTestMutation = useMutation({
    mutationFn: (d: TestDetailForm) =>
      contractsApi.addTestDetail(contractId, {
        testId: d.testId,
        amountRemise: Number(d.amountRemise),
        amountAfterRemise: Number(d.amountAfterRemise),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["contract", contractId] });
      toast.success("Ligne examen ajoutée");
      setAddTestOpen(false);
      testForm.reset();
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
  });

  const closeMutation = useMutation({
    mutationFn: () => contractsApi.close(contractId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["contract", contractId] });
      toast.success("Contrat clôturé");
    },
  });

  // ---- Forms ---------------------------------------------------------------

  const catForm = useForm<CategoryDetailForm>({ resolver: zodResolver(categoryDetailSchema) });
  const testForm = useForm<TestDetailForm>({ resolver: zodResolver(testDetailSchema) });

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

  return (
    <div className="space-y-6">
      <PageHeader
        title={contract.name ?? `Contrat #${contract.id.slice(0, 8)}`}
        action={
          <Link
            href="/contracts"
            className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Retour
          </Link>
        }
      />

      {/* Info card */}
      <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <div className="flex items-start justify-between flex-wrap gap-4">
          <dl className="grid grid-cols-2 gap-x-8 gap-y-3 sm:grid-cols-4">
            <div>
              <dt className="text-xs font-medium text-gray-500 uppercase tracking-wide">Client</dt>
              <dd className="mt-1 text-sm text-gray-900">{contract.clientName ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-gray-500 uppercase tracking-wide">Type</dt>
              <dd className="mt-1 text-sm text-gray-900">{contract.type ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-gray-500 uppercase tracking-wide">Statut</dt>
              <dd className="mt-1">
                <StatusBadge status={contract.status} domain="contract" />
              </dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-gray-500 uppercase tracking-wide">Nbr tests</dt>
              <dd className="mt-1 text-sm text-gray-900">{contract.nbrTests}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-gray-500 uppercase tracking-wide">Date début</dt>
              <dd className="mt-1 text-sm text-gray-900">{formatDate(contract.startDate)}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-gray-500 uppercase tracking-wide">Date fin</dt>
              <dd className="mt-1 text-sm text-gray-900">{formatDate(contract.endDate)}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-gray-500 uppercase tracking-wide">Facturation unique</dt>
              <dd className="mt-1 text-sm text-gray-900">{contract.invoiceUnique ? "Oui" : "Non"}</dd>
            </div>
          </dl>

          <PermissionGate permission={PERMISSIONS.EDIT_CONTRACTS}>
            <div className="flex gap-2">
              {contract.status === "INACTIF" && (
                <button
                  type="button"
                  onClick={() => activateMutation.mutate()}
                  disabled={activateMutation.isPending}
                  className="inline-flex items-center gap-2 rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 transition-colors disabled:opacity-50"
                >
                  <CheckCircle className="h-4 w-4" />
                  Activer
                </button>
              )}
              {contract.status === "ACTIF" && (
                <button
                  type="button"
                  onClick={() => closeMutation.mutate()}
                  disabled={closeMutation.isPending}
                  className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 transition-colors disabled:opacity-50"
                >
                  <XCircle className="h-4 w-4" />
                  Clôturer
                </button>
              )}
            </div>
          </PermissionGate>
        </div>

        {contract.description && (
          <p className="mt-4 text-sm text-gray-600 border-t border-gray-100 pt-4">
            {contract.description}
          </p>
        )}
      </div>

      {/* Details / lignes */}
      <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="flex items-center justify-between p-5 border-b border-gray-100">
          <h2 className="text-base font-semibold text-gray-900">Lignes du contrat</h2>
          <PermissionGate permission={PERMISSIONS.EDIT_CONTRACTS}>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => { catForm.reset(); setAddCatOpen(true); }}
                className="inline-flex items-center gap-2 rounded-lg border border-blue-300 bg-blue-50 px-3 py-1.5 text-sm font-medium text-blue-700 hover:bg-blue-100 transition-colors"
              >
                <Tag className="h-4 w-4" />
                Par catégorie
              </button>
              <button
                type="button"
                onClick={() => { testForm.reset(); setAddTestOpen(true); }}
                className="inline-flex items-center gap-2 rounded-lg border border-purple-300 bg-purple-50 px-3 py-1.5 text-sm font-medium text-purple-700 hover:bg-purple-100 transition-colors"
              >
                <FlaskConical className="h-4 w-4" />
                Par examen
              </button>
            </div>
          </PermissionGate>
        </div>

        {details.length === 0 ? (
          <div className="flex items-center justify-center h-32">
            <p className="text-sm text-gray-400">Aucune ligne dans ce contrat</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Examen / Catégorie</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-600">Prix</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-600">Remise %</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-600">Montant remise</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-600">Après remise</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {details.map((d) => (
                  <tr key={d.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 text-gray-900">
                      {d.labTestName ??
                        getCategoryName(d.categoryTestId) ??
                        (d.categoryTestId
                          ? `Catégorie #${d.categoryTestId.slice(0, 8)}`
                          : "—")}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-700">{formatAmount(d.price)}</td>
                    <td className="px-4 py-3 text-right text-gray-700">
                      {d.pourcentage != null ? `${d.pourcentage}%` : "—"}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-700">{formatAmount(d.amountRemise)}</td>
                    <td className="px-4 py-3 text-right font-medium text-gray-900">
                      {formatAmount(d.amountAfterRemise)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <PermissionGate permission={PERMISSIONS.EDIT_CONTRACTS}>
                        <button
                          type="button"
                          onClick={() => setDeleteDetail(d)}
                          className="inline-flex items-center justify-center rounded p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600 transition-colors"
                          title="Supprimer cette ligne"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </PermissionGate>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ====================== MODALS ====================== */}

      {/* Ajouter ligne par catégorie */}
      <CrudModal
        isOpen={addCatOpen}
        onClose={() => setAddCatOpen(false)}
        title="Ajouter une ligne — par catégorie"
        onSubmit={catForm.handleSubmit((d) => addCategoryMutation.mutate(d))}
        submitLabel="Ajouter"
        isSubmitting={addCategoryMutation.isPending}
      >
        <div className="flex flex-col gap-4">
          <RHFSelect
            control={catForm.control}
            name="categoryTestId"
            label="Catégorie d'examen"
            required
            options={categories.map((c) => ({ value: c.id, label: c.name }))}
            placeholder="Sélectionner une catégorie…"
            error={catForm.formState.errors.categoryTestId?.message}
          />
          <FormField label="Remise (%)" required error={catForm.formState.errors.discount?.message}>
            <input
              type="number"
              {...catForm.register("discount")}
              min={0}
              max={100}
              step={0.01}
              placeholder="Ex : 10"
              className={inputClass}
            />
          </FormField>
        </div>
      </CrudModal>

      {/* Ajouter ligne par examen */}
      <CrudModal
        isOpen={addTestOpen}
        onClose={() => setAddTestOpen(false)}
        title="Ajouter une ligne — par examen"
        onSubmit={testForm.handleSubmit((d) => addTestMutation.mutate(d))}
        submitLabel="Ajouter"
        isSubmitting={addTestMutation.isPending}
      >
        <div className="flex flex-col gap-4">
          <RHFSelect
            control={testForm.control}
            name="testId"
            label="Examen"
            required
            options={examens.map((e) => ({ value: e.id, label: e.name }))}
            placeholder="Sélectionner un examen…"
            error={testForm.formState.errors.testId?.message}
          />
          <FormField label="Montant remise (FCFA)" required error={testForm.formState.errors.amountRemise?.message}>
            <input
              type="number"
              {...testForm.register("amountRemise")}
              min={0}
              placeholder="Ex : 500"
              className={inputClass}
            />
          </FormField>
          <FormField label="Montant après remise (FCFA)" required error={testForm.formState.errors.amountAfterRemise?.message}>
            <input
              type="number"
              {...testForm.register("amountAfterRemise")}
              min={0}
              placeholder="Ex : 4500"
              className={inputClass}
            />
          </FormField>
        </div>
      </CrudModal>

      {/* Confirmation suppression ligne */}
      <ConfirmModal
        isOpen={deleteDetail !== null}
        onClose={() => setDeleteDetail(null)}
        onConfirm={() => { if (deleteDetail) deleteDetailMutation.mutate(deleteDetail.id); }}
        title="Supprimer cette ligne"
        message={`Supprimer "${deleteDetail?.labTestName ?? "cette ligne"}" du contrat ?`}
        confirmLabel="Supprimer"
        confirmVariant="danger"
        isLoading={deleteDetailMutation.isPending}
      />
    </div>
  );
}
