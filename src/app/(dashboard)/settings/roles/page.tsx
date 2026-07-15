"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Pencil, Trash2 } from "lucide-react";
import type { ColumnDef } from "@tanstack/react-table";
import type { AxiosError } from "axios";
import type { UseFormReturn } from "react-hook-form";
import { LimitedSelect as ReactSelect } from "@/components/ui/LimitedSelect";

import { PageHeader } from "@/components/ui/PageHeader";
import { DataTable } from "@/components/common/DataTable";
import { CrudModal } from "@/components/common/CrudModal";
import { ConfirmModal } from "@/components/common/ConfirmModal";
import { PermissionGate } from "@/components/common/PermissionGate";
import { FormField } from "@/components/ui/FormField";
import { usePermissions } from "@/hooks/usePermissions";
import { PERMISSIONS } from "@/lib/constants/permissions";
import { usersApi, Role, Permission, RoleRequest } from "@/lib/api/users";

// ---------------------------------------------------------------------------
// Zod schema
// ---------------------------------------------------------------------------

const roleSchema = z.object({
  name: z.string().min(1, "Le nom du rôle est requis"),
  description: z.string().optional(),
  permissionIds: z.array(z.string()).optional(),
});

type RoleFormValues = z.infer<typeof roleSchema>;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const inputClass =
  "w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:bg-gray-50 disabled:text-gray-500";

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function RolesPage() {
  const { can } = usePermissions();
  const queryClient = useQueryClient();

  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [selectedRole, setSelectedRole] = useState<Role | null>(null);

  // ---- Queries & Mutations ------------------------------------------------

  const { data: rolesData, isLoading } = useQuery({
    queryKey: ["roles"],
    queryFn: () => usersApi.getRoles().then((r) => r.data),
  });

  const { data: permissionsData } = useQuery({
    queryKey: ["permissions"],
    queryFn: () => usersApi.getAllPermissions().then((r) => r.data),
  });

  const roles: Role[] = rolesData?.content ?? [];
  const permissions: Permission[] = permissionsData ?? [];

  const permissionOptions = permissions.map((p) => ({
    value: p.id,
    label: p.name,
    slug: p.slug,
    description: p.description,
  }));

  const createMutation = useMutation({
    mutationFn: (payload: RoleRequest) =>
      usersApi.createRole(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["roles"] });
      toast.success("Rôle créé");
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
    mutationFn: ({
      id,
      data,
    }: {
      id: string;
      data: RoleRequest;
    }) => usersApi.updateRole(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["roles"] });
      toast.success("Rôle modifié");
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
    mutationFn: (id: string) => usersApi.deleteRole(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["roles"] });
      toast.success("Rôle supprimé");
      setDeleteOpen(false);
      setSelectedRole(null);
    },
    onError: (err: AxiosError) => {
      const msg =
        (err.response?.data as { message?: string })?.message ??
        "Une erreur est survenue";
      toast.error(msg);
    },
  });

  // ---- Forms ---------------------------------------------------------------

  const createForm = useForm<RoleFormValues>({
    resolver: zodResolver(roleSchema),
    defaultValues: {
      name: "",
      description: "",
      permissionIds: [],
    },
  });

  const editForm = useForm<RoleFormValues>({
    resolver: zodResolver(roleSchema),
  });

  // ---- Handlers ------------------------------------------------------------

  function openEdit(role: Role) {
    setSelectedRole(role);
    editForm.reset({
      name: role.name,
      description: role.description ?? "",
      permissionIds: (role.permissions ?? []).map((p) => p.id),
    });
    setEditOpen(true);
  }

  function openDelete(role: Role) {
    setSelectedRole(role);
    setDeleteOpen(true);
  }

  function onCreateSubmit(values: RoleFormValues) {
    createMutation.mutate({
      name: values.name,
      description: values.description,
      permissionIds: values.permissionIds ?? [],
    });
  }

  function onEditSubmit(values: RoleFormValues) {
    if (!selectedRole) return;
    updateMutation.mutate({
      id: selectedRole.id,
      data: {
        name: values.name,
        description: values.description,
        permissionIds: values.permissionIds ?? [],
      },
    });
  }

  // ---- Columns -------------------------------------------------------------

  const columns: ColumnDef<Role>[] = [
    {
      header: "Nom du rôle",
      accessorKey: "name",
      cell: ({ row }) => (
        <span className="font-medium text-gray-900">{row.original.name}</span>
      ),
    },
    {
      header: "Description",
      id: "description",
      cell: ({ row }) => (
        <span className="text-sm text-gray-600">
          {row.original.description ?? <span className="text-gray-400 text-xs">—</span>}
        </span>
      ),
    },
    {
      header: "Nb permissions",
      id: "permCount",
      cell: ({ row }) => {
        const count = (row.original.permissions ?? []).length;
        return (
          <span className="inline-flex items-center rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-700">
            {count} permission{count !== 1 ? "s" : ""}
          </span>
        );
      },
    },
    {
      header: "Permissions",
      id: "permList",
      cell: ({ row }) => {
        const perms = row.original.permissions ?? [];
        if (perms.length === 0) {
          return <span className="text-gray-400 text-xs">Aucune</span>;
        }
        return (
          <div className="flex flex-wrap gap-1 max-w-xs">
            {perms.slice(0, 3).map((p) => (
              <span
                key={p.id}
                className="inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-xs font-mono text-gray-700"
              >
                {p.slug}
              </span>
            ))}
            {perms.length > 3 && (
              <span className="text-xs text-gray-400">+{perms.length - 3}</span>
            )}
          </div>
        );
      },
    },
    {
      header: "Actions",
      id: "actions",
      cell: ({ row }) => (
        <div className="flex items-center gap-2">
          <PermissionGate permission={PERMISSIONS.MANAGE_ROLES}>
            <button
              onClick={() => openEdit(row.original)}
              className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs font-medium bg-blue-600 text-white hover:bg-blue-700 transition-colors"
              aria-label="Modifier"
            >
              <Pencil className="h-3.5 w-3.5" />
              Modifier
            </button>
          </PermissionGate>
          <PermissionGate permission={PERMISSIONS.MANAGE_ROLES}>
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

  // ---- Render --------------------------------------------------------------

  return (
    <div className="space-y-6">
      <PageHeader
        title="Rôles"
        action={
          can(PERMISSIONS.MANAGE_ROLES) ? (
            <button
              onClick={() => {
                createForm.reset();
                setCreateOpen(true);
              }}
              className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
            >
              Ajouter un rôle
            </button>
          ) : undefined
        }
      />

      <div className="rounded-xl border border-gray-200 bg-white shadow-sm p-5">
        <DataTable columns={columns} data={roles} isLoading={isLoading} />
      </div>

      {/* ---- Modal création ---- */}
      <CrudModal
        isOpen={createOpen}
        onClose={() => setCreateOpen(false)}
        title="Ajouter un rôle"
        size="xl"
        contentClassName="min-h-[85vh]"
        onSubmit={createForm.handleSubmit(onCreateSubmit)}
        submitLabel="Ajouter un rôle"
        isSubmitting={createMutation.isPending}
      >
        <RoleForm form={createForm} permissionOptions={permissionOptions} />
      </CrudModal>

      {/* ---- Modal édition ---- */}
      <CrudModal
        isOpen={editOpen}
        onClose={() => setEditOpen(false)}
        title="Modifier un rôle"
        size="xl"
        contentClassName="min-h-[85vh]"
        onSubmit={editForm.handleSubmit(onEditSubmit)}
        submitLabel="Modifier"
        isSubmitting={updateMutation.isPending}
      >
        <RoleForm form={editForm} permissionOptions={permissionOptions} />
      </CrudModal>

      {/* ---- Modal confirmation suppression ---- */}
      <ConfirmModal
        isOpen={deleteOpen}
        onClose={() => {
          setDeleteOpen(false);
          setSelectedRole(null);
        }}
        onConfirm={() => {
          if (selectedRole) deleteMutation.mutate(selectedRole.id);
        }}
        title="Supprimer ce rôle"
        message={`Voulez-vous vraiment supprimer le rôle "${selectedRole?.name ?? ""}" ? Cette action est irréversible.`}
        confirmLabel="Supprimer"
        confirmVariant="danger"
        isLoading={deleteMutation.isPending}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// RoleForm — formulaire partagé création / édition
// ---------------------------------------------------------------------------

interface PermissionOption {
  value: string;
  label: string;
  slug: string;
  description?: string;
}

interface RoleFormProps {
  form: UseFormReturn<RoleFormValues>;
  permissionOptions: PermissionOption[];
}

function RoleForm({ form, permissionOptions }: RoleFormProps) {
  const {
    register,
    control,
    formState: { errors },
  } = form;

  return (
    <div className="space-y-4">
      <FormField label="Nom du rôle" required error={errors.name?.message}>
        <input
          type="text"
          {...register("name")}
          placeholder="Ex : Médecin, Secrétaire, Admin"
          className={inputClass}
        />
      </FormField>

      <FormField label="Description" error={(errors as { description?: { message?: string } }).description?.message}>
        <input
          type="text"
          {...register("description")}
          placeholder="Description du rôle (optionnel)"
          className={inputClass}
        />
      </FormField>

      <FormField
        label="Permissions"
        error={(errors as { permissionIds?: { message?: string } }).permissionIds?.message}
      >
        <Controller
          name="permissionIds"
          control={control}
          render={({ field }) => (
            <ReactSelect
              instanceId="role-permissions"
              isMulti
              options={permissionOptions}
              value={permissionOptions.filter((o) =>
                (field.value ?? []).includes(o.value)
              )}
              onChange={(selected) =>
                field.onChange(selected.map((s) => s.value))
              }
              placeholder="Sélectionner des permissions..."
              noOptionsMessage={() => "Aucune permission disponible"}
              classNamePrefix="react-select"
              formatOptionLabel={(option) => (
                <span className="font-mono text-xs">{option.slug ?? option.label}</span>
              )}
              styles={{
                control: (base) => ({
                  ...base,
                  borderColor: "#d1d5db",
                  borderRadius: "0.375rem",
                  // Zone nettement plus haute : les permissions sélectionnées (souvent
                  // nombreuses) s'affichent sur beaucoup de lignes, ce qui donne au
                  // formulaire la hauteur souhaitée.
                  minHeight: "320px",
                  alignItems: "flex-start",
                  boxShadow: "none",
                  "&:hover": { borderColor: "#d1d5db" },
                }),
                valueContainer: (base) => ({ ...base, alignItems: "flex-start", maxHeight: "380px", overflowY: "auto" }),
                menu: (base) => ({ ...base, zIndex: 50 }),
              }}
            />
          )}
        />
        <p className="text-xs text-gray-500 mt-1">
          Les slugs de permissions sont affichés. Sélectionnez toutes celles que ce rôle doit avoir.
        </p>
      </FormField>
    </div>
  );
}
