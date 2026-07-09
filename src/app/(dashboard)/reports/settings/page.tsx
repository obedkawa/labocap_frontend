"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Pencil, Trash2, Plus, ArrowLeft, Star, Search } from "lucide-react";
import { toast } from "sonner";
import type { AxiosError } from "axios";

import { PageHeader } from "@/components/ui/PageHeader";
import { ConfirmModal } from "@/components/common/ConfirmModal";
import { CrudModal } from "@/components/common/CrudModal";
import { usePermissions } from "@/hooks/usePermissions";
import { PERMISSIONS } from "@/lib/constants/permissions";
import {
  titleReportsApi,
  type TitleReport,
  type TitleReportRequest,
} from "@/lib/api/reportSettings";
import { usersApi } from "@/lib/api/users";
import type { ApiError } from "@/types/api";

const inputClass =
  "w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500";

type Tab = "titres" | "placeholder";

export default function ReportSettingsPage() {
  const { can } = usePermissions();
  const qc = useQueryClient();
  const canManage =
    can(PERMISSIONS.EDIT_REPORTS) || can(PERMISSIONS.MANAGE_SETTINGS);

  const [tab, setTab] = useState<Tab>("titres");

  // === Onglet Titres ===
  const [createOpen, setCreateOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<TitleReport | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<TitleReport | null>(null);
  const [titleForm, setTitleForm] = useState<TitleReportRequest>({
    name: "",
    isDefault: false,
  });

  const titlesQuery = useQuery({
    queryKey: ["title-reports"],
    queryFn: () =>
      titleReportsApi.findAll({ size: 100 }).then((r) => r.data.content),
  });
  const allTitles = titlesQuery.data ?? [];

  // Champ de recherche local
  const [searchTitre, setSearchTitre] = useState("");
  const titles = useMemo(() => {
    const q = searchTitre.trim().toLowerCase();
    if (!q) return allTitles;
    return allTitles.filter((t) => (t.name ?? "").toLowerCase().includes(q));
  }, [allTitles, searchTitre]);

  const createMutation = useMutation({
    mutationFn: (data: TitleReportRequest) => titleReportsApi.create(data),
    onSuccess: () => {
      toast.success("Titre ajouté");
      qc.invalidateQueries({ queryKey: ["title-reports"] });
      setCreateOpen(false);
      setTitleForm({ name: "", isDefault: false });
    },
    onError: (err: AxiosError<ApiError>) =>
      toast.error(err.response?.data?.message ?? "Erreur"),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: TitleReportRequest }) =>
      titleReportsApi.update(id, data),
    onSuccess: () => {
      toast.success("Titre mis à jour");
      qc.invalidateQueries({ queryKey: ["title-reports"] });
      setEditTarget(null);
    },
    onError: (err: AxiosError<ApiError>) =>
      toast.error(err.response?.data?.message ?? "Erreur"),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => titleReportsApi.delete(id),
    onSuccess: () => {
      toast.success("Titre supprimé");
      qc.invalidateQueries({ queryKey: ["title-reports"] });
      setDeleteTarget(null);
    },
    onError: (err: AxiosError<ApiError>) =>
      toast.error(err.response?.data?.message ?? "Erreur"),
  });

  // Ouvre la modale d'édition en pré-remplissant le formulaire depuis la ligne
  // cliquée, plutôt que de le synchroniser après coup dans un effet.
  const openEdit = (target: TitleReport) => {
    setEditTarget(target);
    setTitleForm({ name: target.name, isDefault: target.isDefault });
  };

  // === Onglet Placeholder ===
  const settingsQuery = useQuery({
    queryKey: ["settings"],
    queryFn: () => usersApi.getSettings().then((r) => r.data),
  });
  const reportFooter = settingsQuery.data?.reportFooter ?? "";

  return (
    <div className="space-y-6">
      <PageHeader
        title="Paramètres des comptes rendu"
        breadcrumbs={[
          { label: "Accueil", href: "/home" },
          { label: "Comptes rendu", href: "/reports" },
          { label: "Paramètres" },
        ]}
        action={
          <div className="flex items-center gap-2">
            <Link
              href="/reports"
              className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
            >
              <ArrowLeft className="h-4 w-4" />
              Retour à la liste des comptes rendu
            </Link>
            {canManage && tab === "titres" && (
              <button
                type="button"
                onClick={() => {
                  setTitleForm({ name: "", isDefault: false });
                  setCreateOpen(true);
                }}
                className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
              >
                <Plus className="h-4 w-4" />
                Ajouter un nouveau titre
              </button>
            )}
          </div>
        }
      />

      {/* Onglets pill */}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setTab("titres")}
          className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
            tab === "titres"
              ? "bg-blue-600 text-white"
              : "bg-gray-100 text-gray-700 hover:bg-gray-200"
          }`}
        >
          Titres
        </button>
        <button
          type="button"
          onClick={() => setTab("placeholder")}
          className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
            tab === "placeholder"
              ? "bg-blue-600 text-white"
              : "bg-gray-100 text-gray-700 hover:bg-gray-200"
          }`}
        >
          Placeholder
        </button>
      </div>

      {/* === Onglet Titres === */}
      {tab === "titres" && (
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-base font-semibold text-gray-800">
              Liste des titres
            </h2>

            {/* Champ de recherche */}
            <div className="relative w-full max-w-xs">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                value={searchTitre}
                onChange={(e) => setSearchTitre(e.target.value)}
                placeholder="Rechercher un titre..."
                className="w-full rounded-md border border-gray-300 pl-9 pr-3 py-2 text-sm shadow-sm placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
          </div>

          <div className="overflow-hidden rounded-lg border border-gray-200">
            <table className="w-full text-sm [&_th]:border-r [&_th]:border-gray-300 [&_th:last-child]:border-r-0 [&_td]:border-r [&_td]:border-gray-200 [&_td:last-child]:border-r-0">
              <thead className="border-b-2 border-gray-300 bg-gray-200">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-gray-800 w-12">
                    #
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-gray-800">
                    Titres
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-gray-800 w-48">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {titlesQuery.isLoading ? (
                  <tr>
                    <td
                      colSpan={3}
                      className="px-4 py-8 text-center text-sm text-gray-500"
                    >
                      Chargement...
                    </td>
                  </tr>
                ) : titles.length === 0 ? (
                  <tr>
                    <td
                      colSpan={3}
                      className="px-4 py-8 text-center text-sm text-gray-500"
                    >
                      Aucun titre
                    </td>
                  </tr>
                ) : (
                  titles.map((t, idx) => (
                    <tr key={t.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-gray-700">{idx + 1}</td>
                      <td className="px-4 py-3">
                        <span
                          className={
                            t.isDefault
                              ? "font-bold text-gray-900"
                              : "text-gray-800"
                          }
                        >
                          {t.name}
                        </span>
                        {t.isDefault && (
                          <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-yellow-100 px-2 py-0.5 text-xs font-medium text-yellow-700">
                            <Star className="h-3 w-3 fill-current" />
                            Par défaut
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {canManage && (
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => openEdit(t)}
                              className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs font-medium bg-blue-600 text-white hover:bg-blue-700"
                            >
                              <Pencil className="h-3.5 w-3.5" />
                              Modifier
                            </button>
                            <button
                              type="button"
                              onClick={() => setDeleteTarget(t)}
                              className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs font-medium bg-red-600 text-white hover:bg-red-700"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                              Supprimer
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* === Onglet Placeholder === */}
      {tab === "placeholder" && (
        <FooterPlaceholderCard
          key={reportFooter}
          initialValue={reportFooter}
          canManage={canManage}
        />
      )}

      {/* Modale création titre */}
      <CrudModal
        isOpen={createOpen}
        onClose={() => setCreateOpen(false)}
        title="Ajouter un nouveau titre"
        onSubmit={() => createMutation.mutate(titleForm)}
        submitLabel="Ajouter"
        isSubmitting={createMutation.isPending}
      >
        <div className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Titre <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={titleForm.name}
              onChange={(e) =>
                setTitleForm({
                  ...titleForm,
                  name: e.target.value.toUpperCase(),
                })
              }
              className={inputClass}
              required
            />
          </div>
          <label className="inline-flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={titleForm.isDefault ?? false}
              onChange={(e) =>
                setTitleForm({ ...titleForm, isDefault: e.target.checked })
              }
              className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <span className="text-sm text-gray-700">
              Définir comme titre par défaut
            </span>
          </label>
        </div>
      </CrudModal>

      {/* Modale édition titre */}
      <CrudModal
        isOpen={!!editTarget}
        onClose={() => setEditTarget(null)}
        title="Modifier le titre"
        onSubmit={() =>
          editTarget &&
          updateMutation.mutate({ id: editTarget.id, data: titleForm })
        }
        submitLabel="Mettre à jour"
        isSubmitting={updateMutation.isPending}
      >
        <div className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Titre <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={titleForm.name}
              onChange={(e) =>
                setTitleForm({
                  ...titleForm,
                  name: e.target.value.toUpperCase(),
                })
              }
              className={inputClass}
              required
            />
          </div>
          <label className="inline-flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={titleForm.isDefault ?? false}
              onChange={(e) =>
                setTitleForm({ ...titleForm, isDefault: e.target.checked })
              }
              className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <span className="text-sm text-gray-700">
              Définir comme titre par défaut
            </span>
          </label>
        </div>
      </CrudModal>

      {/* Modale suppression */}
      <ConfirmModal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
        title="Supprimer ce titre"
        message={
          deleteTarget
            ? `Voulez-vous vraiment supprimer le titre "${deleteTarget.name}" ?`
            : ""
        }
        confirmLabel="Supprimer"
        confirmVariant="danger"
        isLoading={deleteMutation.isPending}
      />
    </div>
  );
}

// Le parent monte ce composant avec `key={reportFooter}` : toute nouvelle valeur
// venue du serveur le remonte et réinitialise l'état local, sans effet de synchro.
function FooterPlaceholderCard({
  initialValue,
  canManage,
}: {
  initialValue: string;
  canManage: boolean;
}) {
  const qc = useQueryClient();
  const [footerValue, setFooterValue] = useState(initialValue);

  const saveFooterMutation = useMutation({
    mutationFn: () => usersApi.updateSettings({ reportFooter: footerValue }),
    onSuccess: () => {
      toast.success("Placeholder mis à jour");
      qc.invalidateQueries({ queryKey: ["settings"] });
    },
    onError: () => toast.error("Erreur lors de la mise à jour"),
  });

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
      <h2 className="mb-4 text-base font-semibold text-gray-800">
        Placeholder du pied de page
      </h2>
      <div className="space-y-4">
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">
            Texte affiché en bas des rapports
          </label>
          <textarea
            value={footerValue}
            onChange={(e) => setFooterValue(e.target.value)}
            rows={8}
            className={inputClass}
            placeholder="Texte du placeholder (footer)..."
          />
        </div>
        {canManage && (
          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => saveFooterMutation.mutate()}
              disabled={saveFooterMutation.isPending}
              className="inline-flex items-center rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {saveFooterMutation.isPending
                ? "Enregistrement..."
                : "Mettre à jour"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
