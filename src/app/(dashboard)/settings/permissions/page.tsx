"use client";

import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Search, Shield, Plus, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import type { AxiosError } from "axios";
import { PageHeader } from "@/components/ui/PageHeader";
import { CrudModal } from "@/components/common/CrudModal";
import { ConfirmModal } from "@/components/common/ConfirmModal";
import { PermissionGate } from "@/components/common/PermissionGate";
import { NativeSelect } from "@/components/ui/NativeSelect";
import { usersApi, Permission } from "@/lib/api/users";
import { PERMISSIONS } from "@/lib/constants/permissions";
import type { ApiError } from "@/types/api";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

// Opérations reconnues (préfixe du slug). Ordre = priorité de détection.
const OPERATIONS = ["manage", "create", "delete", "edit", "view"] as const;

// Extrait l'opération depuis le slug : "view-patients" → "view"
function extractOperation(slug: string): string {
  for (const op of OPERATIONS) {
    if (slug.startsWith(op + "-") || slug === op) return op;
  }
  return slug.split("-")[0];
}

// Extrait la ressource depuis le slug : "view-patients" → "patients"
function extractResource(slug: string): string {
  const op = extractOperation(slug);
  return slug.startsWith(op + "-") ? slug.slice(op.length + 1) : slug;
}

// Slugifie la partie ressource : "Test Orders" → "test-orders"
function slugifyResource(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

// Badge couleur selon l'opération
function OperationBadge({ operation }: { operation: string }) {
  const colors: Record<string, string> = {
    view: "bg-gray-100 text-gray-700",
    create: "bg-green-100 text-green-700",
    edit: "bg-blue-100 text-blue-700",
    delete: "bg-red-100 text-red-700",
    manage: "bg-purple-100 text-purple-700",
  };
  const cls = colors[operation] ?? "bg-yellow-100 text-yellow-700";
  return (
    <span
      className={`inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase ${cls}`}
    >
      {operation}
    </span>
  );
}

const inputClass =
  "w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500";

interface FormState {
  name: string;
  operation: string;
  resource: string;
}

const EMPTY_FORM: FormState = { name: "", operation: "view", resource: "" };

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function PermissionsPage() {
  const [search, setSearch] = useState("");
  const queryClient = useQueryClient();

  // État du formulaire de création / édition
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Permission | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [deleteTarget, setDeleteTarget] = useState<Permission | null>(null);

  const { data: permissions = [], isLoading } = useQuery({
    queryKey: ["permissions"],
    queryFn: () => usersApi.getAllPermissions().then((r) => r.data),
  });

  // Slug reconstruit à partir de l'opération + la ressource.
  const computedSlug = useMemo(() => {
    const res = slugifyResource(form.resource);
    return res ? `${form.operation}-${res}` : "";
  }, [form.operation, form.resource]);

  const filtered = useMemo(() => {
    if (!search) return permissions;
    const q = search.toLowerCase();
    return (permissions as Permission[]).filter(
      (p) => p.slug.includes(q) || p.name.toLowerCase().includes(q)
    );
  }, [permissions, search]);

  const groups = useMemo(() => {
    const map = new Map<string, Permission[]>();
    for (const p of filtered as Permission[]) {
      const resource = extractResource(p.slug);
      if (!map.has(resource)) map.set(resource, []);
      map.get(resource)!.push(p);
    }
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [filtered]);

  // ---- Mutations ----------------------------------------------------------

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ["permissions"] });

  const errorHandler = (err: AxiosError<ApiError>) =>
    toast.error(err.response?.data?.message ?? "Une erreur est survenue");

  const createMutation = useMutation({
    mutationFn: (data: { name: string; slug: string }) =>
      usersApi.createPermission(data),
    onSuccess: () => {
      toast.success("Permission créée avec succès");
      invalidate();
      closeModal();
    },
    onError: errorHandler,
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: { name: string; slug: string } }) =>
      usersApi.updatePermission(id, data),
    onSuccess: () => {
      toast.success("Permission mise à jour");
      invalidate();
      closeModal();
    },
    onError: errorHandler,
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => usersApi.deletePermission(id),
    onSuccess: () => {
      toast.success("Permission supprimée");
      invalidate();
      setDeleteTarget(null);
    },
    onError: errorHandler,
  });

  // ---- Handlers -----------------------------------------------------------

  function openCreate() {
    setEditing(null);
    setForm(EMPTY_FORM);
    setModalOpen(true);
  }

  function openEdit(p: Permission) {
    setEditing(p);
    setForm({
      name: p.name,
      operation: extractOperation(p.slug),
      resource: extractResource(p.slug),
    });
    setModalOpen(true);
  }

  function closeModal() {
    setModalOpen(false);
    setEditing(null);
    setForm(EMPTY_FORM);
  }

  function submit() {
    if (!form.name.trim()) {
      toast.error("Le nom est obligatoire");
      return;
    }
    if (!computedSlug) {
      toast.error("La ressource est obligatoire");
      return;
    }
    const data = { name: form.name.trim(), slug: computedSlug };
    if (editing) {
      updateMutation.mutate({ id: editing.id, data });
    } else {
      createMutation.mutate(data);
    }
  }

  const isSubmitting = createMutation.isPending || updateMutation.isPending;

  return (
    <div className="space-y-6">
      <PageHeader title="Permissions" />

      {/* Barre de recherche + compteur + bouton d'ajout */}
      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
        <div className="relative flex-1 min-w-[240px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            placeholder="Rechercher une permission..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-md border border-gray-300 pl-9 pr-3 py-2 text-sm shadow-sm placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>
        <span className="text-sm text-gray-500">
          {filtered.length} permission{filtered.length !== 1 ? "s" : ""} &middot;{" "}
          {groups.length} groupe{groups.length !== 1 ? "s" : ""}
        </span>
        <PermissionGate permission={PERMISSIONS.CREATE_PERMISSIONS}>
          <button
            type="button"
            onClick={openCreate}
            className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-blue-700"
          >
            <Plus className="h-4 w-4" />
            Ajouter une permission
          </button>
        </PermissionGate>
      </div>

      {/* Grille de groupes */}
      {isLoading ? (
        <div className="text-center text-gray-400 py-12">Chargement...</div>
      ) : groups.length === 0 ? (
        <div className="text-center text-gray-400 py-12">
          Aucune permission trouvée
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {groups.map(([resource, perms]) => (
            <div
              key={resource}
              className="rounded-xl border border-gray-200 bg-white shadow-sm p-4"
            >
              <div className="flex items-center gap-2 mb-3 pb-2 border-b border-gray-100">
                <Shield className="h-4 w-4 text-blue-500" />
                <h3 className="text-sm font-semibold text-gray-800 uppercase tracking-wide">
                  {resource.replace(/_/g, " ")}
                </h3>
                <span className="ml-auto text-xs text-gray-400">
                  {perms.length}
                </span>
              </div>
              <ul className="space-y-1.5">
                {perms.map((p) => (
                  <li key={p.id} className="group flex items-center gap-2">
                    <OperationBadge operation={extractOperation(p.slug)} />
                    <span
                      className="flex-1 text-xs text-gray-600 font-mono truncate"
                      title={p.slug}
                    >
                      {p.slug}
                    </span>
                    <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                      <PermissionGate permission={PERMISSIONS.EDIT_PERMISSIONS}>
                        <button
                          type="button"
                          onClick={() => openEdit(p)}
                          title="Modifier"
                          className="rounded p-1 text-gray-400 hover:bg-blue-50 hover:text-blue-600"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                      </PermissionGate>
                      <PermissionGate permission={PERMISSIONS.DELETE_PERMISSIONS}>
                        <button
                          type="button"
                          onClick={() => setDeleteTarget(p)}
                          title="Supprimer"
                          className="rounded p-1 text-gray-400 hover:bg-red-50 hover:text-red-600"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </PermissionGate>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}

      {/* Modal création / édition */}
      <CrudModal
        isOpen={modalOpen}
        onClose={closeModal}
        title={editing ? "Modifier la permission" : "Ajouter une permission"}
        onSubmit={submit}
        submitLabel={editing ? "Mettre à jour" : "Ajouter"}
        isSubmitting={isSubmitting}
      >
        <div className="space-y-4">
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-gray-700">
              Nom <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="Ex. : Voir les patients"
              className={inputClass}
            />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-gray-700">
                Opération <span className="text-red-500">*</span>
              </label>
              <NativeSelect
                value={form.operation}
                onChange={(e) => setForm({ ...form, operation: e.target.value })}
              >
                <option value="view">view (voir)</option>
                <option value="create">create (créer)</option>
                <option value="edit">edit (modifier)</option>
                <option value="delete">delete (supprimer)</option>
                <option value="manage">manage (gérer)</option>
              </NativeSelect>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-gray-700">
                Ressource <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={form.resource}
                onChange={(e) => setForm({ ...form, resource: e.target.value })}
                placeholder="Ex. : patients"
                className={inputClass}
              />
            </div>
          </div>

          {/* Aperçu du slug technique généré */}
          <div className="rounded-lg bg-gray-50 px-3 py-2 text-xs text-gray-600">
            Slug généré :{" "}
            <span className="font-mono font-semibold text-gray-800">
              {computedSlug || "—"}
            </span>
          </div>
        </div>
      </CrudModal>

      {/* Confirmation de suppression */}
      <ConfirmModal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
        title="Supprimer la permission"
        message={`Voulez-vous vraiment supprimer la permission « ${deleteTarget?.name ?? ""} » (${deleteTarget?.slug ?? ""}) ? Cette action est irréversible.`}
        confirmLabel="Supprimer"
        isLoading={deleteMutation.isPending}
      />
    </div>
  );
}
